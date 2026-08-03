# 09 — Agent Workflow & Task Map

## Default loop

1. `wiki/README.md`
2. One feature page from this wiki
3. Exact route/component/API/script to edit
4. Smallest patch
5. Slice-only validation (`astro check` / targeted script / manual hit of one route)

## Task → starting files

### Homepage / brand

- `src/pages/index.astro`
- `src/components/PixelWaveTitle.tsx`
- `src/components/KnowledgeGraph.tsx`
- `src/styles/global.css`
- `src/layouts/BaseLayout.astro`

### AI search

- `src/pages/api/ai-search.ts`
- `src/pages/api/search.ts`
- `src/pages/index.astro` (form wiring)
- `scripts/init-db.mjs`

### Knowledge graph

- `src/components/KnowledgeGraph.tsx`
- `src/pages/api/knowledge-graph.ts`
- `scripts/test-knowledge-graph.mjs`

### Content model / new collection fields

- `src/content.config.ts`
- `src/lib/content.ts`
- matching `src/pages/**` list/detail templates

### About / messages / ideas

- `src/pages/about.astro`
- `src/components/FunMessages.tsx`
- `src/components/IdeaBox.tsx`
- `src/pages/api/fun-messages.ts`
- `src/pages/api/ideas.ts`
- `src/lib/kv-messages.ts`
- `src/lib/admin-auth.ts`

### Admin

- `src/pages/admin/*.astro`
- `src/pages/api/admin/*.ts`
- `src/lib/admin-auth.ts`

### Knowledge-base sync

- `scripts/sync-obsidian-kb.mjs`
- `scripts/setup-git-hooks.mjs`
- `AUTOMATION.md`

### MCP

- `scripts/kb-mcp-server.mjs`
- `scripts/kb-mcp-http-server.mjs`
- `docs/mcp-knowledge-base.md`

### Toolbox

- `src/lib/toolbox.ts`
- `src/pages/toolbox/index.astro`
- `src/pages/api/admin/toolbox.ts`

### Skills / repos / projects catalogs

- `src/content/skills|repos|projects/**`
- corresponding pages under `src/pages/`
- `scripts/pack-skills.mjs` for skill zips

### Posts pipeline

- `src/content/posts/**`
- `scripts/fetch-articles.mjs`
- `src/lib/article-translation.service.*`
- `src/components/ArticleReader.tsx` / `LanguageToggle.tsx` as needed

## Compact prompt template

```text
Read wiki/README.md first. Then open only the wiki page(s) for [task]
and inspect the linked source files. BlogX_x is an Astro digital garden
(content collections + LanceDB AI search/graph + Obsidian sync + MCP +
Redis interactive modules). Prefer minimal patches; validate only the
touched slice.
```

## WorkflowX commands (when using that harness)

| Command | Mode |
|---------|------|
| `/xwhole` | Full planning + Hybrid Tree |
| `/xlocal` | Local module / PRD-driven |
| `/xunit` | Minimal single-unit change |

Details: `CLAUDE.md`, `.claude/skills/orchestrateX`, `.claude/skills/routeX`.
