---
{
  "schema": "harness-note/2",
  "id": "3f08c0f3-f559-4576-b64c-4cf78018610e",
  "kind": "note",
  "lifecycle": "accepted",
  "created": "2026-10-22",
  "updated": "2026-10-22T06:40:15Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# Engineering Constraints

## Change policy

1. Prefer **minimal, local** changes over broad refactors.
2. Reuse existing route / content / API abstractions.
3. Avoid adding a new backend service unless unavoidable.
4. Validate only the **touched slice** (page, API, or script).
5. Keep agent-facing docs short and task-scoped（本库工程主题 Notes）.

## UI / design

- Stay consistent with **warm paper + brown ink + oxblood** tokens in `src/styles/global.css` and shared finishing in `src/styles/paper-ui.css`.
- Illustrative strokes belong to physical structures or content boundaries; no free-floating drafting marks or separate server-stage backdrop. Direction: [warm-paper-illustration](warm-paper-illustration.md).
- Do not reintroduce an ad-hoc dark theme unless product direction changes.
- Knowledge graph remains **desktop-only**.
- About page: light interaction only — no feature dumping.
- Typography and reading comfort beat decorative chrome.

## Content

- Public lists filter `isDraft === true`.
- Posts are **sourceUrl-centric** (external articles + optional translate pipeline).
- Knowledge base truth source is the LanceDB `content` table (Obsidian vault is an optional, per-item import source) — edit via admin / CLI / `content-store`; never hand-edit `src/content/**` (it is `content-pull` build output).
- Distinguish:
  - 站点内容 wiki → `src/content/wiki` 集合与 `/wiki/[...slug]` 路由（站点内容，照常维护）
  - 工程 Notes → `.agents/notes/`（repo 根 `wiki/` 工程 wiki 已于 2026-10-22 迁入并移除）

## AI / infra

- Rate-limit public AI and write endpoints.
- Do not commit secrets (`.env` stays local).
- LanceDB local vs cloud behavior must respect Vercel (`VERCEL=1`) and fallback flags.
- Rebuild vector index when content retrieval quality is the task (`init-db`), not by hardcoding results in UI.
- 外部 LLM 一律按任一 OpenAI 兼容服务表述与配置（`LLM_*` 三出口），不写死供应商（见[外部 LLM 决策](2026-10-06-decision-external-llm-interface--e7f77826.md)）。

## WorkflowX (agents)

- Main Agent owns direct execution, document maintenance and scheduling（`CLAUDE.md`）；普通 xdo 不建 Task，显式选定既有 Task 才保留验收/评审义务。
- 委派实现/评审走 orchestrateX 模块 02、09（`.claude/skills/orchestrateX/SKILL.md`）；不扮演不可用的独立子代理。
- 工程 Notes 是 **read-first context**，不是阅读你改动文件的替代品。

## Docs hygiene

- 架构或路由地图变化时，用 noteX 更新 `.agents/notes/` 中对应的工程主题 Note（[architecture](architecture.md) / [routes](routes.md) / …）。
- Leave historical PRDs in `docs/` as archive; do not treat them as current schema truth without checking `src/content.config.ts` and code.

---
迁移自 `wiki/08-constraints.md`（2026-10-22 工程 wiki 移除；原文经 git 历史可溯）。
