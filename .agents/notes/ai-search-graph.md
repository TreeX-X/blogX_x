---
{
  "schema": "harness-note/2",
  "id": "09c370a4-a81d-4f05-93ca-e5c4f5d70716",
  "kind": "note",
  "lifecycle": "accepted",
  "created": "2026-10-22",
  "updated": "2026-10-22T06:40:15Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# AI Search & Knowledge Graph

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
| Model | 任一 OpenAI 兼容 LLM（`LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`，见[外部 LLM 决策](2026-10-06-decision-external-llm-interface--e7f77826.md)） |
| Behavior | Natural-language query → vector retrieval → ranked cards + AI answer |
| Scopes | `site` (default) and `toolbox` (uses `searchToolboxItems`) |
| Rate limit | In-memory per IP; window 60s; max from `AI_SEARCH_RATE_LIMIT` (default 5) |
| Related | `src/pages/api/search.ts` |

### Env knobs (search)

- `LANCEDB_URI`, `LANCEDB_API_KEY`, `LANCEDB_TABLE`, `LANCEDB_LOCAL_PATH`, `LANCEDB_CLOUD_REQUIRED`
- `SF_TOKEN`, `SF_MODEL`, `EMBEDDING_DIM`（embedding provider）
- `AI_SEARCH_RATE_LIMIT`, `SEARCH_ALLOW_LOCAL_FALLBACK`, `VERCEL`
- `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`（任一 OpenAI 兼容端点，三项全必填）
- 完整模板：`.env.example`

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

CI rebuild: `.github/workflows/vector-sync.yml` on content/script/package changes (see [pipeline-mcp](pipeline-mcp.md)).

## Touch points by task

| Task | Start here |
|------|------------|
| Home search UX | `src/pages/index.astro` |
| Search API / ranking / rate limit | `src/pages/api/ai-search.ts` |
| Graph layout / hover / theme | `src/components/KnowledgeGraph.tsx` |
| Graph API thresholds | `src/pages/api/knowledge-graph.ts` |
| Reindex | `scripts/init-db.mjs` |

---
迁移自 `wiki/05-ai-search-graph.md`（2026-10-22 工程 wiki 移除；原文经 git 历史可溯）。
