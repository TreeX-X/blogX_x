# 03 — Routes

Base layout nav (`src/layouts/BaseLayout.astro`): 首页 · 文章 · 知识库 · 仓库 · Skills · 工具箱 · 关于.

## Public pages

| Route | File | Notes |
|-------|------|--------|
| `/` | `src/pages/index.astro` | Hero + AI search, latest posts/KB, knowledge graph |
| `/posts` | `src/pages/posts/index.astro` | Post list |
| `/posts/[slug]` | `src/pages/posts/[slug].astro` | Post detail (often external-sourced) |
| `/knowledge-base` | `src/pages/knowledge-base/index.astro` | KB list |
| `/knowledge-base/[...slug]` | `src/pages/knowledge-base/[...slug].astro` | Nested KB paths |
| `/wiki/[...slug]` | `src/pages/wiki/[...slug].astro` | **Site** content wiki (not `wiki/` eng docs) |
| `/repos` | `src/pages/repos/index.astro` | Repo catalog |
| `/skills` | `src/pages/skills/index.astro` | Skills list |
| `/skills/[slug]` | `src/pages/skills/[slug].astro` | Skill detail + download |
| `/toolbox` | `src/pages/toolbox/index.astro` | External tools (data in `src/lib/toolbox.ts`) |
| `/about` | `src/pages/about.astro` | About + FunMessages + IdeaBox |

## Admin pages

| Route | File |
|-------|------|
| `/admin` | `src/pages/admin/index.astro` |
| `/admin/ideas` | `src/pages/admin/ideas.astro` |
| `/admin/messages` | `src/pages/admin/messages.astro` |
| `/admin/posts` | `src/pages/admin/posts.astro` |
| `/admin/projects` | `src/pages/admin/projects.astro` |
| `/admin/repos` | `src/pages/admin/repos.astro` |
| `/admin/skills` | `src/pages/admin/skills.astro` |
| `/admin/toolbox` | `src/pages/admin/toolbox.astro` |

Auth helpers: `src/lib/admin-auth.ts`.

## API surface

| Endpoint | File | Concern |
|----------|------|---------|
| `/api/ai-search` | `src/pages/api/ai-search.ts` | GLM + LanceDB (+ toolbox scope) |
| `/api/search` | `src/pages/api/search.ts` | Search variant |
| `/api/knowledge-graph` | `src/pages/api/knowledge-graph.ts` | Graph nodes/links from vectors |
| `/api/fun-messages` | `src/pages/api/fun-messages.ts` | Public messages |
| `/api/ideas` | `src/pages/api/ideas.ts` | Public ideas |
| `/api/ideas/admin` | `src/pages/api/ideas/admin.ts` | Ideas moderation API |
| `/api/admin/login` | `src/pages/api/admin/login.ts` | Admin session |
| `/api/admin/logout` | `src/pages/api/admin/logout.ts` | Logout |
| `/api/admin/redis-health` | `src/pages/api/admin/redis-health.ts` | KV health |
| `/api/admin/ideas` | `src/pages/api/admin/ideas.ts` | Admin ideas |
| `/api/admin/messages` | `src/pages/api/admin/messages.ts` | Admin messages |
| `/api/admin/posts` | `src/pages/api/admin/posts.ts` | Admin posts |
| `/api/admin/projects` | `src/pages/api/admin/projects.ts` | Admin projects |
| `/api/admin/repos` | `src/pages/api/admin/repos.ts` | Admin repos |
| `/api/admin/skills` | `src/pages/api/admin/skills.ts` | Admin skills |
| `/api/admin/toolbox` | `src/pages/api/admin/toolbox.ts` | Admin toolbox |

Most content APIs use `prerender = false` (SSR).

## Important UI behaviors

- Home AI search posts to `/api/ai-search` with scope `site` (toolbox has its own scope).
- Knowledge graph component is **desktop-oriented** (hide on small screens).
- About page already hosts interactive modules — avoid piling more heavy widgets there.
