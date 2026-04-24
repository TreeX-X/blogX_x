# BlogX_x Repo Context Index

> Purpose: compact entry point for future agent chats.
> How to use: provide this file first, then only the specific feature files linked below.
> Scope: repository-level context, not implementation details.

## 1. Project Identity

- Project: BlogX_x
- Type: personal digital garden / blog / knowledge base
- Stack: Astro 6 + React 19 + TypeScript + Tailwind CSS 4
- Primary language: Chinese
- Design direction: minimal black-and-white, strong typography, low-distraction reading
- Core philosophy: content-first, light interaction, low maintenance

## 2. What This Repo Does

- Publishes blog posts from `src/content/posts`
- Publishes local knowledge base content from `src/content/knowledge-base`
- Exposes AI search backed by LanceDB + GLM
- Exposes knowledge-graph visualization backed by vector similarity
- Syncs Obsidian markdown into the repo knowledge base
- Supports MCP access to knowledge-base content
- Contains interactive about-page modules for messages and ideas

## 3. Core Routes

- `/` home: AI search, latest posts, latest knowledge-base entries, knowledge graph
- `/posts` list page
- `/posts/[slug]` post page
- `/knowledge-base` list page
- `/knowledge-base/[...slug]` knowledge-base detail page
- `/about` about page with interaction modules
- `/admin/ideas` ideas moderation page
- `/api/*` AI search, knowledge graph, messages, ideas, admin endpoints

## 4. Key Files by Concern

### Layout and navigation
- `src/layouts/BaseLayout.astro`
- `src/styles/global.css`

### Home and content pages
- `src/pages/index.astro`
- `src/pages/about.astro`
- `src/pages/posts/index.astro`
- `src/pages/posts/[slug].astro`
- `src/pages/knowledge-base/index.astro`
- `src/pages/knowledge-base/[...slug].astro`

### Content model
- `src/content.config.ts`
- `src/lib/content.ts`
- `src/content/posts/**`
- `src/content/knowledge-base/**`
- `src/content/wiki/**`

### AI and graph APIs
- `src/pages/api/ai-search.ts`
- `src/pages/api/search.ts`
- `src/pages/api/knowledge-graph.ts`

### Message and idea features
- `src/components/FunMessages.tsx`
- `src/components/IdeaBox.tsx`
- `src/pages/api/fun-messages.ts`
- `src/pages/api/ideas.ts`
- `src/pages/api/ideas/admin.ts`
- `src/pages/api/admin/login.ts`
- `src/pages/api/admin/logout.ts`
- `src/pages/api/admin/redis-health.ts`
- `src/lib/kv-messages.ts`
- `src/lib/admin-auth.ts`
- `src/pages/admin/ideas.astro`

### Knowledge-base sync and MCP
- `scripts/sync-obsidian-kb.mjs`
- `scripts/init-db.mjs`
- `scripts/kb-mcp-server.mjs`
- `scripts/kb-mcp-http-server.mjs`
- `docs/mcp-knowledge-base.md`
- `AUTOMATION.md`

### Product docs
- `docs/blogX_x.md`
- `docs/message-prd.md`
- `docs/toolBox-prd.md`

## 5. Data Collections

### Posts
- Required fields: `title`, `date`, `description`
- Optional fields: `tags`, `coverImage`, `isDraft`
- Source: `src/content/posts`

### Knowledge base
- Optional fields: `title`, `date`, `description`, `tags`, `isDraft`
- Source: `src/content/knowledge-base`
- Sync source: Obsidian vault via script

## 6. Runtime and Environment

- Node.js >= 22.12.0
- Astro content collections drive static content rendering
- LanceDB is used for vector search and graph similarity
- Vercel adapter is used for deployment
- External AI model: GLM-4.5-AIR

## 7. Important Behaviors

- Home page search is AI-assisted and returns ranked content cards
- Knowledge graph should stay mobile-hidden and desktop-only
- About page already contains interactive modules and should not be overloaded further
- Message and idea features rely on Redis-backed storage and rate limits
- Knowledge-base content is synced automatically by hooks and scripts

## 8. Current Engineering Constraints

- Prefer minimal, local changes over broad refactors
- Keep UI consistent with the existing monochrome editorial style
- Reuse existing route/content abstractions when adding new pages
- Avoid adding a new backend unless absolutely necessary
- When editing content docs, keep them short enough to be useful as agent context

## 9. Recommended Future Agent Workflow

1. Read this file first.
2. Read only the feature-specific file for the task.
3. Inspect the exact route or component to modify.
4. Make the smallest patch that satisfies the request.
5. Validate the touched slice only.

## 10. Useful Starting Points by Task

- Homepage work: `src/pages/index.astro`, `src/components/KnowledgeGraph.tsx`, `src/pages/api/ai-search.ts`
- Content model changes: `src/content.config.ts`, `src/lib/content.ts`
- About-page changes: `src/pages/about.astro`, `src/components/FunMessages.tsx`, `src/components/IdeaBox.tsx`
- Knowledge-base sync changes: `scripts/sync-obsidian-kb.mjs`, `scripts/init-db.mjs`
- MCP changes: `scripts/kb-mcp-server.mjs`, `scripts/kb-mcp-http-server.mjs`, `docs/mcp-knowledge-base.md`

## 11. Suggested Compact Prompt Template

Use this when starting a new chat:

"Read docs/repo-context-index.md first. Then inspect only the files relevant to [task]. The repo is BlogX_x, an Astro-based personal digital garden with content collections, AI search, knowledge graph, Obsidian sync, and Redis-backed interactive modules. Keep the change minimal and validate only the touched slice."
