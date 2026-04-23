// Type definitions
export interface FunMessage {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  status: "approved" | "rejected";
  ip: string;
}

export interface Idea {
  id: string;
  name: string;
  idea: string;
  createdAt: number;
  status: "pending" | "approved" | "rejected";
  implemented: boolean;
  adminNote?: string;
  ip: string;
}

type RedisValue = string | null;

const env = (name: string): string | undefined => {
  const fromProcess = process.env[name];
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[name];
  const value = fromProcess || fromMeta;
  return value && value.length > 0 ? value : undefined;
};

// Redis / Upstash configuration
const REDIS_URL = env("UPSTASH_REDIS_REST_URL") || env("KV_REST_API_URL");
const REDIS_TOKEN = env("UPSTASH_REDIS_REST_TOKEN") || env("KV_REST_API_TOKEN");

// Message feature configuration
const MAX_DISPLAY = Number.parseInt(env("MESSAGE_MAX_DISPLAY") || "20", 10);
const GLOBAL_LIMIT = Number.parseInt(env("MESSAGE_RATE_LIMIT_GLOBAL") || "50", 10);
const GLOBAL_WINDOW_SECONDS = Number.parseInt(env("MESSAGE_RATE_LIMIT_WINDOW") || "60", 10);
const IP_LIMIT = Number.parseInt(env("MESSAGE_RATE_LIMIT_IP") || "3", 10);
const IP_WINDOW_SECONDS = Number.parseInt(env("MESSAGE_RATE_LIMIT_IP_WINDOW") || "300", 10);

function redisBaseUrl() {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Redis configuration missing");
  }
  return REDIS_URL.replace(/\/$/, "");
}

async function redisCommand(command: string[]): Promise<unknown> {
  const response = await fetch(redisBaseUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Redis error: HTTP ${response.status}${errorText ? ` - ${errorText}` : ""}`);
  }

  return response.json();
}

async function redisGet(key: string): Promise<RedisValue> {
  const result = await redisCommand(["GET", key]);
  if (typeof result === "string" || result === null) return result;
  if (typeof result === "object" && result !== null && "result" in result) {
    const value = (result as { result?: unknown }).result;
    return typeof value === "string" ? value : value == null ? null : String(value);
  }
  return null;
}

async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await redisCommand(["SETEX", key, String(ttlSeconds), value]);
    return;
  }
  await redisCommand(["SET", key, value]);
}

async function redisIncr(key: string): Promise<number> {
  const result = await redisCommand(["INCR", key]);
  if (typeof result === "number") return result;
  if (typeof result === "string") return Number(result);
  if (Array.isArray(result) && result.length > 0) return Number(result[0]);
  return 0;
}

async function redisExpire(key: string, ttlSeconds: number): Promise<void> {
  await redisCommand(["EXPIRE", key, String(ttlSeconds)]);
}

function buildIpKey(ip: string) {
  return `fun-messages:ip:${ip}`;
}

function buildGlobalWindowKey() {
  return "messages:global:window";
}

function buildGlobalCountKey(windowStart: number) {
  return `messages:global:count:${windowStart}`;
}

function sanitizeText(value: string) {
  return value.trim();
}

function parseMessageList<T>(data: RedisValue): T[] {
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function checkSlidingWindowLimit(prefix: string, limit: number, windowSeconds: number, ip: string) {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const key = `${prefix}:${ip}:${windowStart}`;
  const nextCount = await redisIncr(key);
  if (nextCount === 1) {
    await redisExpire(key, windowSeconds + 5);
  }
  return {
    allowed: nextCount <= limit,
    remaining: Math.max(0, limit - nextCount),
    resetAt: (windowStart + windowSeconds) * 1000,
  };
}

async function checkGlobalLimit() {
  const windowStart = Math.floor(Date.now() / 1000 / GLOBAL_WINDOW_SECONDS) * GLOBAL_WINDOW_SECONDS;
  const windowKey = buildGlobalWindowKey();
  const countKey = buildGlobalCountKey(windowStart);
  const storedWindow = await redisGet(windowKey);
  if (storedWindow !== String(windowStart)) {
    await redisSet(windowKey, String(windowStart), GLOBAL_WINDOW_SECONDS + 5);
  }

  const nextCount = await redisIncr(countKey);
  if (nextCount === 1) {
    await redisExpire(countKey, GLOBAL_WINDOW_SECONDS + 5);
  }

  return {
    allowed: nextCount <= GLOBAL_LIMIT,
    remaining: Math.max(0, GLOBAL_LIMIT - nextCount),
    resetAt: (windowStart + GLOBAL_WINDOW_SECONDS) * 1000,
  };
}

/**
 * Check if IP is rate limited for fun messages
 */
export async function checkFunMessageRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  try {
    return await checkSlidingWindowLimit("fun-messages:ip", IP_LIMIT, IP_WINDOW_SECONDS, ip);
  } catch (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true, remaining: IP_LIMIT, resetAt: Date.now() + IP_WINDOW_SECONDS * 1000 };
  }
}

/**
 * Check global rate limit for all messages
 */
export async function checkGlobalRateLimit(): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  try {
    return await checkGlobalLimit();
  } catch (error) {
    console.error("Global rate limit check error:", error);
    return { allowed: true, remaining: GLOBAL_LIMIT, resetAt: Date.now() + GLOBAL_WINDOW_SECONDS * 1000 };
  }
}

/**
 * Submit a fun message
 */
export async function submitFunMessage(name: string, content: string, ip: string): Promise<{
  success: boolean;
  message?: string;
  messageId?: string;
  audit?: {
    safe: boolean;
    reason?: string;
  };
}> {
  const ipCheck = await checkFunMessageRateLimit(ip);
  const globalCheck = await checkGlobalRateLimit();

  if (!ipCheck.allowed || !globalCheck.allowed) {
    return {
      success: false,
      message: ipCheck.allowed
        ? "全局请求过于频繁，请稍后再试"
        : "您的请求过于频繁，请稍后再试",
    };
  }

  const message: FunMessage = {
    id: crypto.randomUUID(),
    name: sanitizeText(name),
    content: sanitizeText(content),
    createdAt: Date.now(),
    status: "pending",
    ip,
  };

  try {
    const audit = await auditContent(name, content);
    if (!audit.safe) {
      return {
        success: false,
        message: audit.reason || "留言未通过审核",
        audit,
      };
    }

    const existing = await redisGet("fun-messages:list");
    const list = parseMessageList<FunMessage>(existing);
    message.status = "approved";
    list.unshift(message);
    const trimmed = list.slice(0, 100);
    await redisSet("fun-messages:list", JSON.stringify(trimmed));

    return {
      success: true,
      messageId: message.id,
      message: "审核通过，留言已发布",
      audit,
    };
  } catch (error) {
    console.error("Submit fun message error:", error);
    return { success: false, message: "提交失败，请稍后重试" };
  }
}

/**
 * Get approved fun messages
 */
export async function getApprovedFunMessages(limit: number = MAX_DISPLAY): Promise<FunMessage[]> {
  try {
    const data = await redisGet("fun-messages:list");
    const messages = parseMessageList<FunMessage>(data);
    return messages.filter((msg) => msg.status === "approved").slice(0, limit);
  } catch (error) {
    console.error("Get approved fun messages error:", error);
    return [];
  }
}

/**
 * Get all fun messages for moderation or status lookup
 */
export async function getAllFunMessages(): Promise<FunMessage[]> {
  try {
    const data = await redisGet("fun-messages:list");
    return parseMessageList<FunMessage>(data);
  } catch (error) {
    console.error("Get all fun messages error:", error);
    return [];
  }
}

/**
 * AI content moderation
 */
export async function auditContent(name: string, content: string): Promise<{
  safe: boolean;
  reason?: string;
}> {
  const GLM_API_KEY = env("GLM_API_KEY");
  const GLM_MODEL = env("GLM_MODEL") || "glm-4.5-air";

  if (!GLM_API_KEY) {
    return { safe: false, reason: "AI审核服务未配置" };
  }

  const prompt = `请审核以下留言内容是否合适公开展示。

判断标准：
1. 不包含广告、推销内容
2. 不包含辱骂、攻击性语言
3. 不包含敏感政治内容
4. 不包含恶意代码或可疑链接

留言人昵称：${name}
留言内容：${content}

请只回复 JSON 格式，不要有其他内容：
{"safe": true或false, "reason": "如果不安全，说明原因"}`;

  try {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`GLM API error: ${response.status}`);
    }

    const data = await response.json();
    const responseContent = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content;

    if (responseContent) {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result;
      }
    }

    return { safe: false, reason: "AI审核失败" };
  } catch (error) {
    console.error("AI audit failed:", error);
    return { safe: false, reason: "AI审核服务暂时不可用" };
  }
}

/**
 * Process and approve fun messages
 */
export async function processFunMessages(): Promise<void> {
  try {
    const data = await redisGet("fun-messages:list");
    if (!data) return;

    const messages = parseMessageList<FunMessage>(data);
    const pendingMessages = messages.filter((msg) => msg.status === "pending");
    if (pendingMessages.length === 0) return;

    for (const message of pendingMessages) {
      const audit = await auditContent(message.name, message.content);
      const index = messages.findIndex((m) => m.id === message.id);
      if (index !== -1) {
        if (audit.safe) {
          messages[index].status = "approved";
        } else {
          messages.splice(index, 1);
        }
      }
    }

    await redisSet("fun-messages:list", JSON.stringify(messages));
  } catch (error) {
    console.error("Process fun messages error:", error);
  }
}

/**
 * Submit an idea
 */
export async function submitIdea(name: string, idea: string, ip: string): Promise<{
  success: boolean;
  message?: string;
  ideaId?: string;
}> {
  const ipCheck = await checkSlidingWindowLimit("ideas:ip", 5, 300, ip);
  const globalCheck = await checkGlobalRateLimit();

  if (!ipCheck.allowed || !globalCheck.allowed) {
    return {
      success: false,
      message: ipCheck.allowed ? "全局请求过于频繁，请稍后再试" : "您的请求过于频繁，请稍后再试",
    };
  }

  const newIdea: Idea = {
    id: crypto.randomUUID(),
    name: sanitizeText(name),
    idea: sanitizeText(idea),
    createdAt: Date.now(),
    status: "pending",
    implemented: false,
    ip,
  };

  try {
    const existing = await redisGet("ideas:list");
    const list = parseMessageList<Idea>(existing);
    list.unshift(newIdea);
    await redisSet("ideas:list", JSON.stringify(list));

    return {
      success: true,
      ideaId: newIdea.id,
      message: "感谢提交，等待管理员审核",
    };
  } catch (error) {
    console.error("Submit idea error:", error);
    return { success: false, message: "提交失败，请稍后重试" };
  }
}

/**
 * Get all ideas for admin
 */
export async function getAllIdeas(): Promise<Idea[]> {
  try {
    const data = await redisGet("ideas:list");
    return parseMessageList<Idea>(data);
  } catch (error) {
    console.error("Get all ideas error:", error);
    return [];
  }
}

/**
 * Get approved ideas for display
 */
export async function getApprovedIdeas(): Promise<{
  implemented: Idea[];
  pending: Idea[];
}> {
  try {
    const data = await redisGet("ideas:list");
    if (!data) {
      return { implemented: [], pending: [] };
    }

    const ideas = parseMessageList<Idea>(data);
    const approved = ideas.filter((idea) => idea.status === "approved");

    return {
      implemented: approved.filter((idea) => idea.implemented),
      pending: approved.filter((idea) => !idea.implemented),
    };
  } catch (error) {
    console.error("Get approved ideas error:", error);
    return { implemented: [], pending: [] };
  }
}

/**
 * Review and update idea status
 */
export async function reviewIdea(
  ideaId: string,
  action: "approve" | "reject",
  implemented: boolean = false,
  adminNote?: string
): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const data = await redisGet("ideas:list");
    if (!data) {
      return { success: false, message: "点子不存在" };
    }

    const ideas = parseMessageList<Idea>(data);
    const index = ideas.findIndex((idea) => idea.id === ideaId);

    if (index === -1) {
      return { success: false, message: "点子不存在" };
    }

    if (action === "approve") {
      ideas[index].status = "approved";
      ideas[index].implemented = implemented;
      if (adminNote) ideas[index].adminNote = adminNote;
    } else {
      ideas[index].status = "rejected";
      if (adminNote) ideas[index].adminNote = adminNote;
    }

    await redisSet("ideas:list", JSON.stringify(ideas));

    return {
      success: true,
      message: action === "approve" ? "审核通过" : "已拒绝",
    };
  } catch (error) {
    console.error("Review idea error:", error);
    return { success: false, message: "审核失败，请稍后重试" };
  }
}

export async function pingRedis(): Promise<{
  ok: boolean;
  provider: string;
  message: string;
}> {
  try {
    const current = await redisGet("blogx:healthcheck");
    const nextValue = String(Date.now());
    await redisSet("blogx:healthcheck", nextValue, 60);
    return {
      ok: true,
      provider: REDIS_URL?.includes("upstash") ? "upstash" : "redis-rest",
      message: current ? "Redis 已连通" : "Redis 已连通，首次写入成功",
    };
  } catch (error) {
    return {
      ok: false,
      provider: REDIS_URL?.includes("upstash") ? "upstash" : "redis-rest",
      message: error instanceof Error ? error.message : "Redis 连接失败",
    };
  }
}
