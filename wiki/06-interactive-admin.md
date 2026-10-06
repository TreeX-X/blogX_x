# 06 — Interactive Modules & Admin

## About-page modules

| Feature | Component | API | Storage |
|---------|-----------|-----|---------|
| Fun messages | `src/components/FunMessages.tsx` | `/api/fun-messages` | Redis/KV via `src/lib/kv-messages.ts` |
| Idea box | `src/components/IdeaBox.tsx` | `/api/ideas` | same KV layer |

Page shell: `src/pages/about.astro`.

### Design rules

- About already has interaction — **do not overload** with more heavy modules.
- Public writes should keep **rate limits** and sanitization.
- Moderation happens in admin, not by expanding public UI.

## Admin auth

| Piece | Path |
|-------|------|
| Auth helper | `src/lib/admin-auth.ts` |
| Login | `src/pages/api/admin/login.ts` |
| Logout | `src/pages/api/admin/logout.ts` |
| Redis health | `src/pages/api/admin/redis-health.ts` |

## Admin surfaces

全部读写 LanceDB `content` 表（posts / repos / projects / knowledgeBase / wiki / toolbox / skills），
或 Upstash KV（messages / ideas）。

| UI | API | 集合 |
|----|-----|------|
| `admin/index.astro` | hub（逐集合计数） | — |
| `admin/posts.astro` | `api/admin/posts.ts` + `api/admin/intake.ts` | `posts`（含 AI 上传面板：URL / 文件 / 粘贴正文 → 草稿） |
| `admin/repos.astro` | `api/admin/repos.ts` | `repos` |
| `admin/projects.astro` | `api/admin/projects.ts` | `projects` |
| `admin/knowledge-base.astro` | `api/admin/knowledge-base.ts` | `knowledgeBase`（保留嵌套路径） |
| `admin/wiki.astro` | `api/admin/wiki.ts` | `wiki`（保留嵌套路径） |
| `admin/toolbox.astro` | `api/admin/toolbox.ts` | `toolbox` |
| `admin/skills.astro` | `api/admin/skills.ts` | `skills` |
| `admin/messages.astro` | `api/admin/messages.ts` | KV |
| `admin/ideas.astro` | `api/ideas/admin.ts`, `api/admin/ideas.ts` | KV |

面板与 CLI（`scripts/content-intake.mjs` / `content-publish.mjs`）共用同一个
`src/lib/article-intake.service.ts`，读写同一批 draft 记录：面板的草稿箱能看到 CLI 写的草稿，
反之亦然。草稿权威口径是记录的 `status` 字段，不靠本地文件。

`frontmatter` 的共享键（posts 的 `fetched`、knowledgeBase 的 `source`）由脚本写入、面板从不
构造；`src/pages/api/admin/_helpers.ts` 在整份替换 frontmatter 时保留它们，静默丢弃就是丢数据。

## 管理入口的两条边界

| 边界 | 事实 |
|------|------|
| 生产环境 | `/admin` 与 `/api/admin` 一律 404（`src/middleware.ts`），公开写入面为零 |
| 本地 dev | 面板与全部 `/api/admin/*` 可用；写入一律走 `src/lib/content-store.ts`（LanceDB `content` 表的唯一入口） |

凭据缺失或云端连不上时 `content-store` 会降级到本地 `.lancedb`：**读路径容忍，写路径一律抛错**
（`assertWritable`）——响亮的失败优于静默写错靶。

## KV layer

- `src/lib/kv-messages.ts` — messages/ideas persistence helpers
- Depends on Vercel KV / Redis env configuration
- Health check endpoint for ops

## Related product docs (history)

- `docs/message-prd.md`
- `docs/toolBox-prd.md`

Prefer implementing against **current code** over outdated PRD field lists.
