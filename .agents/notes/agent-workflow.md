---
{
  "schema": "harness-note/2",
  "id": "f18c0b89-ee9f-4942-9e43-229b0948e505",
  "kind": "note",
  "lifecycle": "accepted",
  "created": "2026-10-22",
  "updated": "2026-10-22T06:40:15Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# Agent Workflow & Task Map

## Default loop

1. `.agents/notes/module.md`（项目根模块入口）
2. 只打开与任务相关的工程主题 Note（下表）
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

### Knowledge-base import

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

### Posts pipeline / reading

- `src/content/posts/**`
- `scripts/fetch-articles.mjs`
- `src/lib/article-translation.service.*`
- `src/components/ArticleReader.tsx` / `LanguageToggle.tsx` / `ShareBar.tsx` as needed
- `src/components/ReadingRail.tsx`（文章 / 知识库 / 站点 wiki 共用左栏，见[阅读左栏决策](2026-10-19-decision-article-reading-rail--11f13778.md)）

### Server case / 3D 机箱

- `src/pages/server.astro`
- `src/components/CaseHero.tsx` / `CaseSvg.tsx` / `PixelCaseHero.tsx`
- `src/components/pixel-case-scene.ts` / `voxel-case.ts` / `src/components/server/`
- 形态与验收边界见[服务器需求](2026-10-15-server-tab-linecase-requirement--103be143.md)

## Compact prompt template

```text
Read .agents/notes/module.md first. Then open only the engineering topic
note(s) for [task] and inspect the linked source files. BlogX_x is an Astro
digital garden (content collections + LanceDB AI search/graph + MCP +
Redis interactive modules). Prefer minimal patches; validate only the
touched slice.
```

## WorkflowX (when using that harness)

路由模式 xdo / xdel / xflow / xarch / xstatus 经 `.claude/skills/orchestrateX/SKILL.md`；
任务与文档纪律见 `CLAUDE.md` 与 [constraints](constraints.md)。

---
迁移自 `wiki/09-agent-workflow.md`（2026-10-22 工程 wiki 移除；原文经 git 历史可溯）。
