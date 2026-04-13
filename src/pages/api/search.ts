import type { APIRoute } from "astro";
import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";

dotenv.config();

export const prerender = false;

const env = (name: string): string | undefined => {
  const fromProcess = process.env[name];
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[name];
  const value = fromProcess || fromMeta;
  return value && value.length > 0 ? value : undefined;
};

const SF_MODEL = env("SF_MODEL") || "BAAI/bge-m3";
const TABLE_NAME = env("LANCEDB_TABLE") || "blog_index";
const EMBEDDING_DIM = Number.parseInt(env("EMBEDDING_DIM") || "1024", 10);
const LOCAL_DB_PATH = env("LANCEDB_LOCAL_PATH") || ".lancedb";
const IS_VERCEL = env("VERCEL") === "1";
const ALLOW_LOCAL_FALLBACK = env("SEARCH_ALLOW_LOCAL_FALLBACK")
  ? env("SEARCH_ALLOW_LOCAL_FALLBACK") === "true"
  : !IS_VERCEL;

function getLimit(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "10"), 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.max(1, Math.min(parsed, 20));
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
        model: SF_MODEL,
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

async function trySearchCloud(vector: number[], limit: number) {
  const uri = env("LANCEDB_URI");
  const apiKey = env("LANCEDB_API_KEY");
  if (!uri || !apiKey) return { rows: null as Record<string, unknown>[] | null, error: "missing_cloud_env" };

  try {
    const cloudDb = await lancedb.connect(uri, { apiKey });
    const cloudTable = await cloudDb.openTable(TABLE_NAME);
    const rows = await cloudTable.search(vector).limit(limit).toArray();
    return { rows, error: null as string | null };
  } catch (error) {
    return {
      rows: null as Record<string, unknown>[] | null,
      error: error instanceof Error ? error.message : "cloud_search_failed",
    };
  }
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(query: string) {
  return normalizeText(query)
    .split(/[\s,，。！？、;；|/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function isShortCjkQuery(query: string) {
  const compact = query.replace(/\s+/g, "");
  return /[\u4e00-\u9fff]/.test(compact) && compact.length <= 4;
}

function isShortAsciiQuery(query: string) {
  const compact = query.toLowerCase().replace(/\s+/g, "");
  return /^[a-z0-9]+$/.test(compact) && compact.length <= 6;
}

function isAsciiSingleTokenQuery(query: string) {
  const terms = tokenize(query);
  if (terms.length !== 1) return false;
  const compact = terms[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  return compact.length > 0 && compact.length <= 24;
}

function getSafeUrl(row: Record<string, unknown>) {
  const raw = String(row.url ?? "");
  if (raw.startsWith("/posts/") || raw.startsWith("/notes/")) return raw;

  const collection = String(row.collection ?? "");
  const slug = String(row.slug ?? "").trim();
  if (!slug) return "#";
  if (collection === "posts" || collection === "notes") return `/${collection}/${slug}`;
  return "#";
}

function getSemanticThreshold(distances: number[]) {
  if (distances.length === 0) return Number.NEGATIVE_INFINITY;
  const sorted = [...distances].sort((a, b) => a - b);
  const best = sorted[0];
  return Math.min(best + 0.12, 0.62);
}

function hasConfidentSemanticSignal(distances: number[]) {
  if (distances.length === 0) return false;
  const sorted = [...distances].sort((a, b) => a - b);
  const best = sorted[0];
  if (best <= 0.35) return true;

  // If top results are too dense, semantic ranking is likely noise.
  const probeIndex = Math.min(sorted.length - 1, 3);
  const gap = sorted[probeIndex] - best;
  return gap >= 0.04;
}

async function searchLanceDB(query: string, limit: number) {
  const vector = await embedQuery(query);
  const candidateLimit = Math.max(limit * 5, 20);

  const cloud = await trySearchCloud(vector, candidateLimit);

  let rows: Record<string, unknown>[] | null = cloud.rows;
  if (!rows && ALLOW_LOCAL_FALLBACK) {
    const localDb = await lancedb.connect(LOCAL_DB_PATH);
    const localTable = await localDb.openTable(TABLE_NAME);
    rows = await localTable.search(vector).limit(candidateLimit).toArray();
  }

  if (!rows) {
    if (cloud.error === "missing_cloud_env") {
      throw new Error(
        "Search backend is not configured. Please set LANCEDB_URI and LANCEDB_API_KEY in Vercel project env."
      );
    }
    throw new Error(`LanceDB cloud search failed: ${cloud.error}`);
  }

  const terms = tokenize(query);
  const strictKeywordMode = isShortCjkQuery(query) || isShortAsciiQuery(query) || isAsciiSingleTokenQuery(query);

  const ranked = rows.map((row) => {
    const title = String(row.title ?? "");
    const content = String(row.content ?? "");
    const haystack = normalizeText(`${title} ${content}`);

    let lexicalScore = 0;
    for (const term of terms) {
      const termNormalized = normalizeText(term);
      if (!termNormalized) continue;
      if (normalizeText(title).includes(termNormalized)) lexicalScore += 4;
      if (haystack.includes(termNormalized)) lexicalScore += 2;
    }

    const distance =
      typeof row._distance === "number"
        ? row._distance
        : typeof row.score === "number"
          ? row.score
          : Number.POSITIVE_INFINITY;

    return { row, lexicalScore, distance };
  });

  const finiteDistances = ranked.map((x) => x.distance).filter((x) => Number.isFinite(x)) as number[];
  const semanticThreshold = getSemanticThreshold(finiteDistances);
  const semanticSignalOk = hasConfidentSemanticSignal(finiteDistances);

  const filtered = strictKeywordMode
    ? ranked.filter((item) => item.lexicalScore > 0)
    : ranked.filter((item) => item.lexicalScore > 0 || (semanticSignalOk && item.distance <= semanticThreshold));

  const sorted = filtered
    .sort((a, b) => {
      if (b.lexicalScore !== a.lexicalScore) return b.lexicalScore - a.lexicalScore;
      return a.distance - b.distance;
    })
    .slice(0, limit);

  return sorted.map(({ row, distance }) => ({
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    url: getSafeUrl(row),
    collection: String(row.collection ?? ""),
    score: Number.isFinite(distance) ? distance : null,
  }));
}

async function runSearch(query: string, limitRaw: unknown) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return new Response(JSON.stringify({ error: "Missing query: q" }), { status: 400 });
  }

  try {
    const limit = getLimit(limitRaw);
    const results = await searchLanceDB(normalizedQuery, limit);
    return new Response(JSON.stringify({ query: normalizedQuery, count: results.length, results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Search failed" }),
      { status: 500 }
    );
  }
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  return runSearch(url.searchParams.get("q") ?? "", url.searchParams.get("limit"));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const query = typeof body.q === "string" ? body.q : "";
  return runSearch(query, body.limit);
};
