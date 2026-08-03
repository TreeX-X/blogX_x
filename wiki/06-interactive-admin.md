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

| UI | API |
|----|-----|
| `admin/ideas.astro` | `api/ideas/admin.ts`, `api/admin/ideas.ts` |
| `admin/messages.astro` | `api/admin/messages.ts` |
| `admin/posts.astro` | `api/admin/posts.ts` |
| `admin/projects.astro` | `api/admin/projects.ts` |
| `admin/repos.astro` | `api/admin/repos.ts` |
| `admin/skills.astro` | `api/admin/skills.ts` |
| `admin/toolbox.astro` | `api/admin/toolbox.ts` |
| `admin/index.astro` | hub |

## KV layer

- `src/lib/kv-messages.ts` — messages/ideas persistence helpers
- Depends on Vercel KV / Redis env configuration
- Health check endpoint for ops

## Related product docs (history)

- `docs/message-prd.md`
- `docs/toolBox-prd.md`

Prefer implementing against **current code** over outdated PRD field lists.
