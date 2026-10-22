---
{
  "schema": "harness-note/2",
  "id": "962f009d-f07e-40d5-ab19-deb13679560f",
  "kind": "note",
  "lifecycle": "accepted",
  "created": "2026-10-22",
  "updated": "2026-10-22T06:40:15Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# Architecture

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
| Content store | LanceDB `content` 表 | `src/lib/content-store.ts` 是唯一读写入口 |
| Vector DB | `@lancedb/lancedb` | Local `.lancedb` + optional cloud |
| LLM | 任一 OpenAI 兼容服务 | `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`，唯一配置出口 `getLlmConfig()`（见[外部 LLM 决策](2026-10-06-decision-external-llm-interface--e7f77826.md)）；翻译、AI 搜索、intake 提取、留言审核共用 |
| KV | `@vercel/kv` | Messages / ideas / health |

Config: `astro.config.mjs` (alias `@` → `src`). Env template: `.env.example`。

## Directory map (engineering)

| Path | Responsibility |
|------|----------------|
| `src/pages/` | Routes + API endpoints |
| `src/layouts/` | Shell (`BaseLayout.astro`) |
| `src/components/` | React/Astro UI pieces（含 `server/` 机箱组件） |
| `src/lib/` | Content helpers, content store, schemas, KV, auth, toolbox, article DB, intake service |
| `src/content/` | **构建产物**：`content-pull` 从 `content` 表写出的 markdown，不入 git |
| `src/styles/global.css` | Design tokens + global styles |
| `scripts/` | content-pull / content-migrate / content-intake / content-publish / fetch-articles / sync-obsidian-kb / init-db / MCP / maintenance / pack-skills |
| `public/` | Static assets, skill zips, logo |
| `.agents/notes/` | **本库**：工程 Notes（需求/决策/想法/任务 + 工程参考主题） |
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
| `fetch-articles` / `fetch-articles:translate` | Refresh bilingual bodies of posts (top-up by default, `--force` for all) |
| `maintenance*` | Ops helpers |
| `test:kg` | Knowledge-graph smoke test |

## Subsystems (deep links)

- Content model → [content-model](content-model.md)
- AI + graph → [ai-search-graph](ai-search-graph.md)
- Messages/admin → [interactive-admin](interactive-admin.md)
- Sync/MCP/CI → [pipeline-mcp](pipeline-mcp.md)

---
迁移自 `wiki/02-architecture.md`（2026-10-22 工程 wiki 移除；原文经 git 历史可溯）。
