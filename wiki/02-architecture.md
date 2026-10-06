# 02 — Architecture

## High-level

```
LanceDB Cloud「content」表（内容唯一真源，单表 + collection 字段）
        │
        ├── scripts/content-pull.mjs  →  src/content/**（构建期产物，predev/prebuild 生成）
        │       └── Astro pages (SSR via Vercel adapter)
        │             └── React islands (graph, messages, ideas, reader, …)
        │
        ├── scripts/init-db.mjs  →  LanceDB blog_index（内容派生索引，供搜索与图谱）
        │
        ├── Redis / Vercel KV  →  messages, ideas, rate limits
        │
        ├── AI 上传/发布通道（src/lib/article-intake.service.ts）
        │       └── dev 面板 /admin + CLI content:intake、content:publish
        │
        └── MCP servers (stdio / HTTP)  →  agent tool access to KB
```

内容不在 git 里：`src/content/**` 由 `content-pull` 从 `content` 表全量拉取后写盘，
`.gitignore` 忽略。任何机器 clone + 配好 `.env` 即可构建与管理，不依赖本机 Obsidian vault。
写入面在公网为零（`/admin`、`/api/admin` 在生产由 middleware 404）。

## Runtime shape

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Astro 6 | `output: "server"` |
| Adapter | `@astrojs/vercel` | Production host |
| UI islands | React 19 + `@astrojs/react` | Interactive modules only |
| Styles | Tailwind 4 + `global.css` tokens | Design system in CSS vars |
| Content | `astro:content` collections | Schemas in `src/lib/content-schemas.ts`（唯一定义处， Zod from `astro/zod`） |
| Content store | LanceDB `content` table | `src/lib/content-store.ts` 是唯一读写入口 |
| Vector DB | `@lancedb/lancedb` | Local `.lancedb` + optional cloud |
| LLM | GLM (e.g. GLM-4.5-AIR) | Translation, AI search, intake extraction |
| KV | `@vercel/kv` | Messages / ideas / health |

Config: `astro.config.mjs` (alias `@` → `src`).

## Directory map (engineering)

| Path | Responsibility |
|------|----------------|
| `src/pages/` | Routes + API endpoints |
| `src/layouts/` | Shell (`BaseLayout.astro`) |
| `src/components/` | React/Astro UI pieces |
| `src/lib/` | Content helpers, content store, schemas, KV, auth, toolbox, article DB, intake service |
| `src/content/` | **构建产物**：`content-pull` 从 `content` 表写出的 markdown，不入 git |
| `src/styles/global.css` | Design tokens + global styles |
| `scripts/` | content-pull / content-migrate / content-intake / content-publish / fetch-articles / sync-obsidian-kb / init-db / MCP / maintenance / pack-skills |
| `public/` | Static assets, skill zips, logo |
| `wiki/` | **This** engineering wiki |
| `docs/` | Historical PRDs / design extractions notes |
| `.claude/` / `.codex/` | Agent workflow tooling (WorkflowX) |
| `.githooks/` | pre-commit（no-op）+ pre-push（本地库自检，见 `AUTOMATION.md`） |

## Key libraries (runtime)

- Content/UI: `astro`, `react`, `react-dom`, `tailwindcss`
- Graph: `react-force-graph-2d`, `d3-force` / selection / zoom
- Search: `@lancedb/lancedb`
- Article fetch/translate: `@mozilla/readability`, `linkedom`, `gray-matter`, DOMPurify
- Deploy/KV: `@astrojs/vercel`, `@vercel/kv`

## Build pipeline (npm)

| Script | Role |
|--------|------|
| `dev` | `astro dev`（`predev` 先 content-pull） |
| `prebuild` | `content-pull.mjs` + `pack-skills.mjs` |
| `build` | `init-db` → `fetch-articles`（只补缺）→ `astro build` |
| `content:pull` / `content:migrate` | content 表 → 磁盘 / 一次性迁移 |
| `content:intake` / `content:publish` | AI 上传 → 草稿 / 校验发布 + Deploy Hook |
| `sync-kb` / `sync-kb:import` | Obsidian vault 候选清单 / 按条目导入 content 表 |
| `init-db` | Rebuild vector index |
| `mcp:kb` / `mcp:kb:http` | MCP servers |
| `fetch-articles` | Refresh bilingual bodies of posts (top-up by default, `--force` for all) |
| `maintenance*` | Ops helpers |
| `test:kg` | Knowledge-graph smoke test |

## Subsystems (deep links)

- Content model → [04-content-model.md](./04-content-model.md)
- AI + graph → [05-ai-search-graph.md](./05-ai-search-graph.md)
- Messages/admin → [06-interactive-admin.md](./06-interactive-admin.md)
- Sync/MCP/CI → [07-pipeline-mcp.md](./07-pipeline-mcp.md)

