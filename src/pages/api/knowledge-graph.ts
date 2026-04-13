import type { APIRoute } from "astro";
import * as lancedb from "@lancedb/lancedb";

export const prerender = false;

type GraphNode = {
  id: string;
  title: string;
  url: string;
  collection: string;
};

type GraphLink = {
  source: string;
  target: string;
  similarity: number;
  distance: number;
};

type Row = Record<string, unknown> & {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  collection?: unknown;
  slug?: unknown;
  vector?: unknown;
  _distance?: unknown;
  score?: unknown;
};

const env = (name: string): string | undefined => {
  const fromProcess = process.env[name];
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[name];
  const value = fromProcess || fromMeta;
  return value && value.length > 0 ? value : undefined;
};

const TABLE_NAME = env("LANCEDB_TABLE") || "blog_index";
const LOCAL_DB_PATH = env("LANCEDB_LOCAL_PATH") || ".lancedb";
const IS_VERCEL = env("VERCEL") === "1";
const ALLOW_LOCAL_FALLBACK = env("SEARCH_ALLOW_LOCAL_FALLBACK")
  ? env("SEARCH_ALLOW_LOCAL_FALLBACK") === "true"
  : !IS_VERCEL;

const MAX_NODES = Number.parseInt(env("KG_MAX_NODES") || "36", 10);
const MAX_EDGES_PER_NODE = Math.min(5, Math.max(1, Number.parseInt(env("KG_MAX_EDGES_PER_NODE") || "5", 10)));
const MIN_NEIGHBORS_PER_NODE = Math.max(1, Math.min(5, Number.parseInt(env("KG_MIN_NEIGHBORS_PER_NODE") || "3", 10)));
const MIN_SIMILARITY = Math.max(0, Math.min(1, Number.parseFloat(env("KG_MIN_SIMILARITY") || "0.35")));

function getSafeUrl(row: Row) {
  const raw = String(row.url ?? "");
  if (raw.startsWith("/posts/") || raw.startsWith("/notes/")) return raw;

  const collection = String(row.collection ?? "");
  const slug = String(row.slug ?? "").trim();
  if (!slug) return "#";
  if (collection === "posts" || collection === "notes") return `/${collection}/${slug}`;
  return "#";
}

function toDistance(row: Row): number {
  if (typeof row._distance === "number") return row._distance;
  if (typeof row.score === "number") return row.score;
  return Number.POSITIVE_INFINITY;
}

function toSimilarity(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  return 1 / (1 + Math.max(0, distance));
}

async function tryOpenCloud() {
  const uri = env("LANCEDB_URI");
  const apiKey = env("LANCEDB_API_KEY");
  if (!uri || !apiKey) return { table: null as any, error: "missing_cloud_env" };

  try {
    const cloudDb = await lancedb.connect(uri, { apiKey });
    const table = await cloudDb.openTable(TABLE_NAME);
    return { table, error: null as string | null };
  } catch (error) {
    return { table: null as any, error: error instanceof Error ? error.message : "cloud_open_failed" };
  }
}

async function openTable() {
  const cloud = await tryOpenCloud();
  if (cloud.table) return cloud.table;

  if (ALLOW_LOCAL_FALLBACK) {
    const localDb = await lancedb.connect(LOCAL_DB_PATH);
    return localDb.openTable(TABLE_NAME);
  }

  if (cloud.error === "missing_cloud_env") {
    throw new Error(
      "Knowledge graph backend is not configured. Please set LANCEDB_URI and LANCEDB_API_KEY in Vercel project env."
    );
  }
  throw new Error(`LanceDB cloud open failed: ${cloud.error}`);
}

function uniqueById(rows: Row[]) {
  const seen = new Set<string>();
  const result: Row[] = [];
  for (const row of rows) {
    const id = String(row.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(row);
  }
  return result;
}

export const GET: APIRoute = async () => {
  try {
    const table = await openTable();
    const baseRows = uniqueById((await table.query().limit(MAX_NODES).toArray()) as Row[]);

    const nodes = baseRows.map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      url: getSafeUrl(row),
      collection: String(row.collection ?? ""),
    })) as GraphNode[];
    const nodeIdSet = new Set(nodes.map((n) => n.id));

    const links: GraphLink[] = [];
    const edgeSet = new Set<string>();

    for (const row of baseRows) {
      const sourceId = String(row.id ?? "");
      const vector = row.vector as number[] | undefined;
      if (!sourceId || !Array.isArray(vector) || vector.length === 0) continue;

      const candidateRows = (await table
        .search(vector)
        .limit(Math.max(20, MAX_EDGES_PER_NODE * 4))
        .toArray()) as Row[];

      const sourceLinks: GraphLink[] = [];
      for (const candidate of candidateRows) {
        const targetId = String(candidate.id ?? "");
        if (!targetId || targetId === sourceId) continue;
        if (!nodeIdSet.has(targetId)) continue;
        const distance = toDistance(candidate);
        const similarity = toSimilarity(distance);
        if (similarity < MIN_SIMILARITY) continue;

        const edgeKey = sourceId < targetId ? `${sourceId}__${targetId}` : `${targetId}__${sourceId}`;
        if (edgeSet.has(edgeKey)) continue;

        sourceLinks.push({ source: sourceId, target: targetId, distance, similarity });
        if (sourceLinks.length >= MAX_EDGES_PER_NODE) break;
      }

      // Prefer 3~5 neighbors, but if threshold is strict allow fewer.
      const picked = sourceLinks.slice(0, Math.max(MIN_NEIGHBORS_PER_NODE, Math.min(MAX_EDGES_PER_NODE, sourceLinks.length)));
      for (const link of picked) {
        const edgeKey = link.source < link.target ? `${link.source}__${link.target}` : `${link.target}__${link.source}`;
        edgeSet.add(edgeKey);
        links.push(link);
      }
    }

    return new Response(
      JSON.stringify({
        nodeCount: nodes.length,
        linkCount: links.length,
        config: {
          minSimilarity: MIN_SIMILARITY,
          maxEdgesPerNode: MAX_EDGES_PER_NODE,
          minNeighborsPerNode: MIN_NEIGHBORS_PER_NODE,
        },
        nodes,
        links,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Knowledge graph failed" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
};
