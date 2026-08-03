# 05 — AI Search & Knowledge Graph

## Shared foundation

- Vector store: **LanceDB** (`@lancedb/lancedb`)
- Default table: env `LANCEDB_TABLE` or `blog_index`
- Local path: env `LANCEDB_LOCAL_PATH` or `.lancedb`
- Index builder: `scripts/init-db.mjs` (`npm run init-db`)
- Embedding dim: env `EMBEDDING_DIM` (default 1024)
- Vercel vs local: cloud URI/API key preferred; local fallback controlled by `SEARCH_ALLOW_LOCAL_FALLBACK`

## AI search

| Item | Detail |
|------|--------|
| API | `src/pages/api/ai-search.ts` → `/api/ai-search` |
| UI | Home form in `src/pages/index.astro` |
| Model | GLM family (e.g. GLM-4.5-AIR); keys via env |
| Behavior | Natural-language query → vector retrieval → ranked cards + AI answer |
| Scopes | `site` (default) and `toolbox` (uses `searchToolboxItems`) |
| Rate limit | In-memory per IP; window 60s; max from `AI_SEARCH_RATE_LIMIT` (default 5) |
| Related | `src/pages/api/search.ts` |

### Env knobs (search)

- `LANCEDB_URI`, `LANCEDB_API_KEY`, `LANCEDB_TABLE`, `LANCEDB_LOCAL_PATH`
- `EMBEDDING_DIM`, `SF_TOKEN` (embedding provider, as used by init/search)
- `AI_SEARCH_RATE_LIMIT`, `SEARCH_ALLOW_LOCAL_FALLBACK`, `VERCEL`
- GLM API key / model vars (project `.env`, not committed)

## Knowledge graph

| Item | Detail |
|------|--------|
| API | `src/pages/api/knowledge-graph.ts` |
| UI | `src/components/KnowledgeGraph.tsx` (home) |
| Library | `react-force-graph-2d` + d3-force |
| Edge idea | For each node, nearest neighbors by vector distance → links |
| Caps | `KG_MAX_NODES` (default 36), `KG_MAX_EDGES_PER_NODE` (≤5), `KG_MIN_NEIGHBORS_PER_NODE`, `KG_MIN_SIMILARITY` (default 0.35) |
| UX rule | **Desktop only** — hide on mobile |

Smoke test: `npm run test:kg` → `scripts/test-knowledge-graph.mjs`.

## Data flow

```
content markdown
  → init-db (chunk/embed/upsert)
  → LanceDB
       ├─ ai-search (query embed + retrieve + LLM answer)
       └─ knowledge-graph (pairwise similarity edges)
```

CI rebuild: `.github/workflows/vector-sync.yml` on content/script/package changes (see [07-pipeline-mcp.md](./07-pipeline-mcp.md)).

## Touch points by task

| Task | Start here |
|------|------------|
| Home search UX | `src/pages/index.astro` |
| Search API / ranking / rate limit | `src/pages/api/ai-search.ts` |
| Graph layout / hover / theme | `src/components/KnowledgeGraph.tsx` |
| Graph API thresholds | `src/pages/api/knowledge-graph.ts` |
| Reindex | `scripts/init-db.mjs` |
