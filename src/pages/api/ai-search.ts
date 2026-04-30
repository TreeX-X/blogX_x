import type { APIRoute } from "astro";
import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";
import { searchToolboxItems } from "../../lib/toolbox";

dotenv.config();

export const prerender = false;

const env = (name: string): string | undefined => {
  const fromProcess = process.env[name];
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[name];
  const value = fromProcess || fromMeta;
  return value && value.length > 0 ? value : undefined;
};

const TABLE_NAME = env("LANCEDB_TABLE") || "blog_index";
const EMBEDDING_DIM = Number.parseInt(env("EMBEDDING_DIM") || "1024", 10);
const LOCAL_DB_PATH = env("LANCEDB_LOCAL_PATH") || ".lancedb";
const IS_VERCEL = env("VERCEL") === "1";
const ALLOW_LOCAL_FALLBACK = env("SEARCH_ALLOW_LOCAL_FALLBACK")
  ? env("SEARCH_ALLOW_LOCAL_FALLBACK") === "true"
  : !IS_VERCEL;
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = Number.parseInt(env("AI_SEARCH_RATE_LIMIT") || "5", 10);
type SearchScope = "site" | "toolbox";

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    const newRecord = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    rateLimitStore.set(ip, newRecord);
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetTime: newRecord.resetTime };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetTime: record.resetTime };
}

function fallbackEmbedding(text: string): number[] {
  const vec = new Array(EMBEDDING_DIM).fill(0);
  const chars = Array.from(text);
  if (chars.length === 0) return vec;

  for (let i = 0; i < chars.length; i++) {
    const code = chars[i].codePointAt(0) ?? 0;
    const idxA = (code * 31 + i * 17) % EMBEDDING_DIM;
    const idxB = (code * 13 + i * 29 + 7) % EMBEDDING_DIM;
    const weight = 1 + (code % 11) / 10;
    vec[idxA] += weight;
    vec[idxB] -= weight * 0.7;
  }

  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

async function embedQuery(query: string): Promise<number[]> {
  const sfToken = env("SF_TOKEN");
  if (!sfToken) return fallbackEmbedding(query);

  try {
    const response = await fetch("https://api.siliconflow.cn/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env("SF_MODEL") || "BAAI/bge-m3",
        input: query,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      throw new Error(`SF embeddings failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const vector = data?.data?.[0]?.embedding;

    if (!vector || !Array.isArray(vector) || vector.length === 0) {
      throw new Error("SF embeddings returned empty vector");
    }

    return vector;
  } catch {
    return fallbackEmbedding(query);
  }
}

async function searchLanceDB(query: string, limit: number) {
  const vector = await embedQuery(query);
  const candidateLimit = Math.max(limit * 5, 20);

  let rows: Record<string, unknown>[] | null = null;

  const uri = env("LANCEDB_URI");
  const apiKey = env("LANCEDB_API_KEY");

  if (uri && apiKey) {
    try {
      const cloudDb = await lancedb.connect(uri, { apiKey });
      const cloudTable = await cloudDb.openTable(TABLE_NAME);
      rows = await cloudTable.search(vector).limit(candidateLimit).toArray();
    } catch (error) {
      console.error("Cloud search error:", error);
    }
  }

  if (!rows && ALLOW_LOCAL_FALLBACK) {
    try {
      const localDb = await lancedb.connect(LOCAL_DB_PATH);
      const localTable = await localDb.openTable(TABLE_NAME);
      rows = await localTable.search(vector).limit(candidateLimit).toArray();
    } catch (error) {
      console.error("Local search error:", error);
    }
  }

  if (!rows) {
    return [];
  }

  return rows.slice(0, limit).map((row) => ({
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    url: String(row.url ?? "#"),
    collection: String(row.collection ?? ""),
    score: typeof row._distance === "number" ? row._distance : null,
  }));
}

async function searchByScope(scope: SearchScope, query: string, limit: number) {
  if (scope === "toolbox") {
    return searchToolboxItems(query, limit);
  }

  return searchLanceDB(query, limit);
}

async function callGLMAPI(query: string, context: string): Promise<string> {
  const GLM_API_KEY = env("GLM_API_KEY");
  const GLM_MODEL = env("GLM_MODEL") || "glm-4.5-air";

  if (!GLM_API_KEY) {
    throw new Error("GLM_API_KEY is missing from runtime environment");
  }

  const systemPrompt = `你是一个智能搜索助手，帮助用户在博客和知识库中查找信息。
基于提供的搜索结果，用简洁、友好的语言回答用户的问题。
如果搜索结果相关，请提及相关文章或笔记的标题。
如果搜索结果不相关，请诚实地告诉用户没有找到相关信息。
回答要简洁明了，不超过150字。`;

  const userPrompt = `用户问题：${query}

搜索结果：
${context}

请基于以上信息回答用户的问题。`;

  try {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`GLM API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
    };

    const messageContent = data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.message?.reasoning_content ||
      "AI 未能生成回复。";

    return messageContent;
  } catch (error) {
    console.error("GLM API call failed:", error);
    return `AI 调用失败：${error instanceof Error ? error.message : "未知错误"}`;
  }
}

function getSearchEnvStatus() {
  return {
    glmApiKey: Boolean(env("GLM_API_KEY")),
    glmModel: env("GLM_MODEL") || "glm-4.5-air",
    lancedbUri: Boolean(env("LANCEDB_URI")),
    lancedbApiKey: Boolean(env("LANCEDB_API_KEY")),
    sfToken: Boolean(env("SF_TOKEN")),
    localFallback: ALLOW_LOCAL_FALLBACK,
  };
}

function formatContext(results: Array<{ title: string; content: string; collection: string }>): string {
  if (results.length === 0) {
    return "没有找到相关内容。";
  }

  return results
    .slice(0, 5)
    .map((r, i) => `[${i + 1}] ${r.title} (${r.collection})\n${r.content.slice(0, 200)}...`)
    .join("\n\n");
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || "unknown";
  const rateCheck = checkRateLimit(ip);

  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: "请求过于频繁，请稍后再试",
        retryAfter: Math.ceil((rateCheck.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateCheck.resetTime),
        },
      }
    );
  }

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const query = typeof body.q === "string" ? body.q.trim() : "";
    const limit = typeof body.limit === "number" ? body.limit : 6;
    const scope = body.scope === "toolbox" ? "toolbox" : "site";

    if (!query) {
      return new Response(JSON.stringify({ error: "请输入搜索内容" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const searchResults = await searchByScope(scope, query, limit);
    const context = formatContext(searchResults);
    const aiResponse = await callGLMAPI(query, context);

    return new Response(
      JSON.stringify({
        query,
        scope,
        aiResponse,
        results: searchResults,
        count: searchResults.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rateCheck.remaining),
          "X-RateLimit-Reset": String(rateCheck.resetTime),
        },
      }
    );
  } catch (error) {
    console.error("AI Search error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "搜索失败",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const GET: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || "unknown";
  const rateCheck = checkRateLimit(ip);

  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: "请求过于频繁，请稍后再试",
        retryAfter: Math.ceil((rateCheck.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateCheck.resetTime),
        },
      }
    );
  }

  const url = new URL(request.url);
  if (url.searchParams.get("health") === "1") {
    return new Response(
      JSON.stringify({ ok: true, env: getSearchEnvStatus() }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const query = url.searchParams.get("q")?.trim() || "";
  const limit = Number.parseInt(url.searchParams.get("limit") || "6", 10);
  const scope = url.searchParams.get("scope") === "toolbox" ? "toolbox" : "site";

  if (!query) {
    return new Response(JSON.stringify({ error: "请输入搜索内容" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const searchResults = await searchByScope(scope, query, limit);
    const context = formatContext(searchResults);
    const aiResponse = await callGLMAPI(query, context);

    return new Response(
      JSON.stringify({
        query,
        scope,
        aiResponse,
        results: searchResults,
        count: searchResults.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rateCheck.remaining),
          "X-RateLimit-Reset": String(rateCheck.resetTime),
        },
      }
    );
  } catch (error) {
    console.error("AI Search error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "搜索失败",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
