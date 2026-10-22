---
{
  "schema": "harness-note/2",
  "id": "a1864471-466d-4c52-adb5-5bac066b8812",
  "kind": "note",
  "lifecycle": "accepted",
  "created": "2026-10-22",
  "updated": "2026-10-22T06:40:15Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# Routes

Base layout nav (`src/layouts/BaseLayout.astro`): 首页 · 文章 · 知识库 · 仓库 · Skills · 工具箱 · 服务器 · 关于.

## Public pages

| Route | File | Notes |
|-------|------|--------|
| `/` | `src/pages/index.astro` | Hero + AI search, latest posts/KB, knowledge graph |
| `/posts` | `src/pages/posts/index.astro` | Post list |
| `/posts/[slug]` | `src/pages/posts/[slug].astro` | Post detail (often external-sourced) |
| `/knowledge-base` | `src/pages/knowledge-base/index.astro` | KB list |
| `/knowledge-base/[...slug]` | `src/pages/knowledge-base/[...slug].astro` | Nested KB paths |
| `/wiki/[...slug]` | `src/pages/wiki/[...slug].astro` | **Site** content wiki（`src/content/wiki` 集合，与工程 Notes 无关） |
| `/repos` | `src/pages/repos/index.astro` | Repo catalog |
| `/skills` | `src/pages/skills/index.astro` | Skills list |
| `/skills/[slug]` | `src/pages/skills/[slug].astro` | Skill detail + download |
| `/toolbox` | `src/pages/toolbox/index.astro` | External tools (data in `src/lib/toolbox.ts`) |
| `/server` | `src/pages/server.astro` | 3D 线条机箱交互页（见[服务器需求](2026-10-15-server-tab-linecase-requirement--103be143.md)） |
| `/about` | `src/pages/about.astro` | About + FunMessages + IdeaBox |

## Admin pages

| Route | File |
|-------|------|
| `/admin` | `src/pages/admin/index.astro` |
| `/admin/ideas` | `src/pages/admin/ideas.astro` |
| `/admin/knowledge-base` | `src/pages/admin/knowledge-base.astro` |
| `/admin/messages` | `src/pages/admin/messages.astro` |
| `/admin/posts` | `src/pages/admin/posts.astro` |
| `/admin/projects` | `src/pages/admin/projects.astro` |
| `/admin/repos` | `src/pages/admin/repos.astro` |
| `/admin/skills` | `src/pages/admin/skills.astro` |
| `/admin/toolbox` | `src/pages/admin/toolbox.astro` |
| `/admin/wiki` | `src/pages/admin/wiki.astro` |

Auth helpers: `src/lib/admin-auth.ts`.

## API surface

| Endpoint | File | Concern |
|----------|------|---------|
| `/api/ai-search` | `src/pages/api/ai-search.ts` | LLM + LanceDB (+ toolbox scope) |
| `/api/search` | `src/pages/api/search.ts` | Search variant |
| `/api/knowledge-graph` | `src/pages/api/knowledge-graph.ts` | Graph nodes/links from vectors |
| `/api/fun-messages` | `src/pages/api/fun-messages.ts` | Public messages |
| `/api/ideas` | `src/pages/api/ideas.ts` | Public ideas |
| `/api/ideas/admin` | `src/pages/api/ideas/admin.ts` | Ideas moderation API |
| `/api/media` | `src/pages/api/media.ts` | 站内媒体代理（规避源站 CORP 跨站拦截） |
| `/api/admin/login` | `src/pages/api/admin/login.ts` | Admin session |
| `/api/admin/logout` | `src/pages/api/admin/logout.ts` | Logout |
| `/api/admin/redis-health` | `src/pages/api/admin/redis-health.ts` | KV health |
| `/api/admin/ideas` | `src/pages/api/admin/ideas.ts` | Admin ideas |
| `/api/admin/messages` | `src/pages/api/admin/messages.ts` | Admin messages |
| `/api/admin/posts` | `src/pages/api/admin/posts.ts` | Admin posts |
| `/api/admin/intake` | `src/pages/api/admin/intake.ts` | AI 上传面板入口（与 `content:intake` 同服务） |
| `/api/admin/projects` | `src/pages/api/admin/projects.ts` | Admin projects |
| `/api/admin/project-readme` | `src/pages/api/admin/project-readme.ts` | 项目 README 快照（不外呼 GitHub，见[项目展示决策](2026-10-07-decision-project-showcase--617f02c5.md)） |
| `/api/admin/repos` | `src/pages/api/admin/repos.ts` | Admin repos |
| `/api/admin/skills` | `src/pages/api/admin/skills.ts` | Admin skills |
| `/api/admin/toolbox` | `src/pages/api/admin/toolbox.ts` | Admin toolbox |
| `/api/admin/knowledge-base` | `src/pages/api/admin/knowledge-base.ts` | Admin KB（保留嵌套路径） |
| `/api/admin/wiki` | `src/pages/api/admin/wiki.ts` | Admin site wiki（保留嵌套路径） |

Most content APIs use `prerender = false` (SSR).

## Important UI behaviors

- Home AI search posts to `/api/ai-search` with scope `site` (toolbox has its own scope).
- Knowledge graph component is **desktop-oriented** (hide on small screens).
- About page already hosts interactive modules — avoid piling more heavy widgets there.
- 文章、知识库、站点 wiki 阅读页共用左栏章节树 `ReadingRail`（见[阅读左栏决策](2026-10-19-decision-article-reading-rail--11f13778.md)）。

---
迁移自 `wiki/03-routes.md`（2026-10-22 工程 wiki 移除；原文经 git 历史可溯）。
