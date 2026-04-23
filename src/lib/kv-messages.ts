// Type definitions
export interface FunMessage {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  status: 'approved' | 'rejected';
  ip: string;
}

export interface Idea {
  id: string;
  name: string;
  idea: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
  implemented: boolean;
  adminNote?: string;
  ip: string;
}

// KV REST API configuration
const KV_URL = import.meta.env.KV_REST_API_URL;
const KV_TOKEN = import.meta.env.KV_REST_API_TOKEN;

// Message feature configuration
const MAX_DISPLAY = Number.parseInt(import.meta.env.MESSAGE_MAX_DISPLAY || '20', 10);
const RATE_LIMIT_IP = Number.parseInt(import.meta.env.MESSAGE_RATE_LIMIT_IP || '3', 10);
const RATE_LIMIT_GLOBAL = Number.parseInt(import.meta.env.MESSAGE_RATE_LIMIT_GLOBAL || '50', 10);
const RATE_LIMIT_WINDOW = 5 * 60; // 5 minutes in seconds

// Helper function for KV REST API calls
async function kvCommand(command: string[]): Promise<unknown> {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV configuration missing');
  }

  const response = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`KV error: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if IP is rate limited for fun messages
 */
export async function checkFunMessageRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const ipKey = `fun-messages:ip:${ip}`;

  try {
    const count = await kvCommand(['GET', ipKey]) as string | null;

    if (!count) {
      await kvCommand(['SETEX', ipKey, String(RATE_LIMIT_WINDOW), '1']);
      return { allowed: true, remaining: RATE_LIMIT_IP - 1 };
    }

    const numCount = Number(count);
    if (numCount >= RATE_LIMIT_IP) {
      return { allowed: false, remaining: 0 };
    }

    await kvCommand(['INCR', ipKey]);
    return { allowed: true, remaining: RATE_LIMIT_IP - (numCount + 1) };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, remaining: RATE_LIMIT_IP };
  }
}

/**
 * Check global rate limit for all messages
 */
export async function checkGlobalRateLimit(): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const globalKey = 'messages:global:count';
  const windowKey = 'messages:global:window';
  const now = Date.now();
  const windowStart = now - 60 * 1000; // 1 minute window

  try {
    const windowStartStr = await kvCommand(['GET', windowKey]) as string | null;

    // Reset if window expired
    if (!windowStartStr || Number(windowStartStr) < windowStart) {
      await kvCommand(['SET', windowKey, String(now)]);
      await kvCommand(['SET', globalKey, '1']);
      await kvCommand(['EXPIRE', windowKey, '60']);
      await kvCommand(['EXPIRE', globalKey, '60']);
      return { allowed: true, remaining: RATE_LIMIT_GLOBAL - 1 };
    }

    const count = await kvCommand(['GET', globalKey]) as string | null;
    const numCount = count ? Number(count) : 0;

    if (numCount >= RATE_LIMIT_GLOBAL) {
      return { allowed: false, remaining: 0 };
    }

    await kvCommand(['INCR', globalKey]);
    return { allowed: true, remaining: RATE_LIMIT_GLOBAL - (numCount + 1) };
  } catch (error) {
    console.error('Global rate limit check error:', error);
    return { allowed: true, remaining: RATE_LIMIT_GLOBAL };
  }
}

/**
 * Submit a fun message
 */
export async function submitFunMessage(name: string, content: string, ip: string): Promise<{
  success: boolean;
  message?: string;
  messageId?: string;
}> {
  // Check rate limits
  const ipCheck = await checkFunMessageRateLimit(ip);
  const globalCheck = await checkGlobalRateLimit();

  if (!ipCheck.allowed || !globalCheck.allowed) {
    return {
      success: false,
      message: ipCheck.allowed
        ? '全局请求过于频繁，请稍后再试'
        : '您的请求过于频繁，请稍后再试'
    };
  }

  // Create message
  const message: FunMessage = {
    id: crypto.randomUUID(),
    name: name.trim(),
    content: content.trim(),
    createdAt: Date.now(),
    status: 'pending',
    ip
  };

  try {
    // Get current list
    const existing = await kvCommand(['GET', 'fun-messages:list']) as string | null;
    const list = existing ? JSON.parse(existing) : [];

    // Add new message
    list.unshift(message);

    // Keep only last 100 messages
    const trimmed = list.slice(0, 100);

    await kvCommand(['SET', 'fun-messages:list', JSON.stringify(trimmed)]);

    return {
      success: true,
      messageId: message.id,
      message: '提交成功，正在等待AI审核'
    };
  } catch (error) {
    console.error('Submit fun message error:', error);
    return { success: false, message: '提交失败，请稍后重试' };
  }
}

/**
 * Get approved fun messages
 */
export async function getApprovedFunMessages(limit: number = MAX_DISPLAY): Promise<FunMessage[]> {
  try {
    const data = await kvCommand(['GET', 'fun-messages:list']) as string | null;

    if (!data) return [];

    const messages = JSON.parse(data) as FunMessage[];
    return messages
      .filter(msg => msg.status === 'approved')
      .slice(0, limit);
  } catch (error) {
    console.error('Get approved fun messages error:', error);
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
  const GLM_API_KEY = import.meta.env.GLM_API_KEY;
  const GLM_MODEL = import.meta.env.GLM_MODEL || 'glm-4.5-air';

  if (!GLM_API_KEY) {
    return { safe: false, reason: 'AI审核服务未配置' };
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
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`GLM API error: ${response.status}`);
    }

    const data = await response.json();
    const responseContent = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content;

    if (responseContent) {
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result;
      }
    }

    return { safe: false, reason: 'AI审核失败' };
  } catch (error) {
    console.error('AI audit failed:', error);
    return { safe: false, reason: 'AI审核服务暂时不可用' };
  }
}

/**
 * Process and approve fun messages
 */
export async function processFunMessages(): Promise<void> {
  try {
    const data = await kvCommand(['GET', 'fun-messages:list']) as string | null;

    if (!data) return;

    const messages = JSON.parse(data) as FunMessage[];
    const pendingMessages = messages.filter(msg => msg.status === 'pending');

    if (pendingMessages.length === 0) return;

    for (const message of pendingMessages) {
      const audit = await auditContent(message.name, message.content);

      const index = messages.findIndex(m => m.id === message.id);
      if (index !== -1) {
        if (audit.safe) {
          messages[index].status = 'approved';
        } else {
          // Remove rejected messages
          messages.splice(index, 1);
        }
      }
    }

    await kvCommand(['SET', 'fun-messages:list', JSON.stringify(messages)]);
  } catch (error) {
    console.error('Process fun messages error:', error);
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
  // Check rate limits
  const ipCheck = await checkFunMessageRateLimit(ip); // Reuse IP rate limit
  const globalCheck = await checkGlobalRateLimit();

  if (!ipCheck.allowed || !globalCheck.allowed) {
    return {
      success: false,
      message: ipCheck.allowed
        ? '全局请求过于频繁，请稍后再试'
        : '您的请求过于频繁，请稍后再试'
    };
  }

  // Create idea
  const newIdea: Idea = {
    id: crypto.randomUUID(),
    name: name.trim(),
    idea: idea.trim(),
    createdAt: Date.now(),
    status: 'pending',
    implemented: false,
    ip
  };

  try {
    // Get current list
    const existing = await kvCommand(['GET', 'ideas:list']) as string | null;
    const list = existing ? JSON.parse(existing) : [];

    // Add new idea
    list.unshift(newIdea);

    await kvCommand(['SET', 'ideas:list', JSON.stringify(list)]);

    return {
      success: true,
      ideaId: newIdea.id,
      message: '感谢提交，等待管理员审核'
    };
  } catch (error) {
    console.error('Submit idea error:', error);
    return { success: false, message: '提交失败，请稍后重试' };
  }
}

/**
 * Get all ideas for admin
 */
export async function getAllIdeas(): Promise<Idea[]> {
  try {
    const data = await kvCommand(['GET', 'ideas:list']) as string | null;

    if (!data) return [];

    return JSON.parse(data) as Idea[];
  } catch (error) {
    console.error('Get all ideas error:', error);
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
    const data = await kvCommand(['GET', 'ideas:list']) as string | null;

    if (!data) {
      return { implemented: [], pending: [] };
    }

    const ideas = JSON.parse(data) as Idea[];
    const approved = ideas.filter(idea => idea.status === 'approved');

    return {
      implemented: approved.filter(idea => idea.implemented),
      pending: approved.filter(idea => !idea.implemented)
    };
  } catch (error) {
    console.error('Get approved ideas error:', error);
    return { implemented: [], pending: [] };
  }
}

/**
 * Review and update idea status
 */
export async function reviewIdea(
  ideaId: string,
  action: 'approve' | 'reject',
  implemented: boolean = false,
  adminNote?: string
): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const data = await kvCommand(['GET', 'ideas:list']) as string | null;

    if (!data) {
      return { success: false, message: '点子不存在' };
    }

    const ideas = JSON.parse(data) as Idea[];
    const index = ideas.findIndex(idea => idea.id === ideaId);

    if (index === -1) {
      return { success: false, message: '点子不存在' };
    }

    if (action === 'approve') {
      ideas[index].status = 'approved';
      ideas[index].implemented = implemented;
      if (adminNote) ideas[index].adminNote = adminNote;
    } else {
      ideas[index].status = 'rejected';
      if (adminNote) ideas[index].adminNote = adminNote;
    }

    await kvCommand(['SET', 'ideas:list', JSON.stringify(ideas)]);

    return {
      success: true,
      message: action === 'approve' ? '审核通过' : '已拒绝'
    };
  } catch (error) {
    console.error('Review idea error:', error);
    return { success: false, message: '审核失败，请稍后重试' };
  }
}