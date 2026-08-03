# 02 — Architecture

## High-level

```
Markdown content collections (src/content/*)
        │
        ├── Astro pages (SSR via Vercel adapter)
        │     └── React islands (graph, messages, ideas, reader, …)
        │
        ├── scripts/init-db.mjs  →  LanceDB index (.lancedb / cloud)
        │     └── used by AI search + knowledge graph APIs
        │
        ├── scripts/sync-obsidian-kb.mjs  →  knowledge-base markdown
        │
        ├── Redis / Vercel KV  →  messages, ideas, rate limits
        │
        └── MCP servers (stdio / HTTP)  →  agent tool access to KB
```

## Runtime shape

| Layer | Tech | Notes |
|-------|------|--------|
| Framework | Astro 6 | `output: "server"` |
| Adapter | `@astrojs/vercel` | Production host |
| UI islands | React 19 + `@astrojs/react` | Interactive modules only |
| Styles | Tailwind 4 + `global.css` tokens | Design system in CSS vars |
| Content | `astro:content` collections | Schemas in `src/content.config.ts` |
| Vector DB | `@lancedb/lancedb` | Local `.lancedb` + optional cloud |
| LLM | GLM (e.g. GLM-4.5-AIR) | AI search answers |
| KV | `@vercel/kv` | Messages / ideas / health |

Config: `astro.config.mjs` (alias `@` → `src`).

## Directory map (engineering)

| Path | Responsibility |
|------|----------------|
| `src/pages/` | Routes + API endpoints |
| `src/layouts/` | Shell (`BaseLayout.astro`) |
| `src/components/` | React/Astro UI pieces |
| `src/lib/` | Content helpers, KV, auth, toolbox, article DB |
| `src/content/` | All markdown collections |
| `src/styles/global.css` | Design tokens + global styles |
| `scripts/` | Sync, index, MCP, fetch, maintenance, pack-skills |
| `public/` | Static assets, skill zips, logo |
| `wiki/` | **This** engineering wiki |
| `docs/` | Historical PRDs / design extractions notes |
| `.claude/` / `.codex/` | Agent workflow tooling (WorkflowX) |

## Key libraries (runtime)

- Content/UI: `astro`, `react`, `react-dom`, `tailwindcss`
- Graph: `react-force-graph-2d`, `d3-force` / selection / zoom
- Search: `@lancedb/lancedb`
- Article fetch/translate: `@mozilla/readability`, `linkedom`, `gray-matter`, DOMPurify
- Deploy/KV: `@astrojs/vercel`, `@vercel/kv`

## Build pipeline (npm)

| Script | Role |
|--------|------|
| `dev` | `astro dev` |
| `prebuild` | `pack-skills.mjs` |
| `build` | `init-db` → `fetch-articles --translate` → `astro build` |
| `sync-kb` / `sync-kb:stage` / `sync-kb:check` | Obsidian → content |
| `init-db` | Rebuild vector index |
| `mcp:kb` / `mcp:kb:http` | MCP servers |
| `fetch-articles[:translate]` | Pull/translate external posts |
| `maintenance*` | Ops helpers |
| `test:kg` | Knowledge-graph smoke test |

## Subsystems (deep links)

- Content model → [04-content-model.md](./04-content-model.md)
- AI + graph → [05-ai-search-graph.md](./05-ai-search-graph.md)
- Messages/admin → [06-interactive-admin.md](./06-interactive-admin.md)
- Sync/MCP/CI → [07-pipeline-mcp.md](./07-pipeline-mcp.md)
