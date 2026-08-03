# 04 — Content Model

Source of truth for schemas: `src/content.config.ts`.  
Shared read helpers: `src/lib/content.ts`.

## Collections

| Collection key | Disk path | List/detail routes |
|----------------|-----------|--------------------|
| `posts` | `src/content/posts/**` | `/posts`, `/posts/[slug]` |
| `knowledgeBase` | `src/content/knowledge-base/**` | `/knowledge-base`, `/knowledge-base/[...slug]` |
| `wiki` | `src/content/wiki/**` | `/wiki/[...slug]` |
| `repos` | `src/content/repos/**` | `/repos` |
| `skills` | `src/content/skills/**` | `/skills`, `/skills/[slug]` |
| `projects` | `src/content/projects/**` | admin + catalog usage |

All loaders: `glob({ pattern: '**/*.md', base: '...' })`.

## Schemas (summary)

### posts

| Field | Required | Notes |
|-------|----------|--------|
| `sourceUrl` | **yes** | External article URL |
| `title` | no | Auto-extract if missing |
| `date` | no | Coerced date / fallback from id |
| `description` | no | SEO / cards |
| `tags` | no | string[] |
| `coverImage` | no | |
| `originalAuthor` | no | |
| `originalLang` | default `en` | |
| `isDraft` | default `false` | Filtered out when published |

Build may fetch/translate via `scripts/fetch-articles.mjs`.

### knowledgeBase / wiki

Optional: `title`, `date`, `description`, `tags`, `isDraft` (default false).  
KB is primarily filled by Obsidian sync.

### repos

Required: `title`, `repoUrl`, `description`.  
Optional: `language`, `tags`, `stars`, `isDraft`.

### skills

Required: `title`, `description`, `skillDir`.  
Optional: `tags`, `version`, `author`, `license`, `isDraft`.  
Zips often under `public/skills-download/`; packed by `scripts/pack-skills.mjs`.

### projects

Required: `title`, `repoUrl`, `description`.  
Optional: `tags`, `isDraft`.

## Helpers (`src/lib/content.ts`)

| Function | Role |
|----------|------|
| `getPublishedPosts` | Non-draft posts, date desc |
| `getKnowledgeBaseEntries` | Non-draft KB |
| `getWikiEntries` | Non-draft site wiki |
| `getRepos` / `getSkills` / `getProjects` | Catalogs |
| `getEntryPath` / `getEntrySlug` | Path/id normalization |
| `getContentDate` / `getContentTitle` / `getContentSummary` | Display fallbacks |
| `formatDate` | `zh-CN` date format |

## Non-collection content

| Source | Role |
|--------|------|
| `src/lib/toolbox.ts` | In-code toolbox items (not a content collection) |
| `src/lib/article-db.ts` / translation services | Post fetch/translate support |
| LanceDB table (default `blog_index`) | Search/graph index over content |

## Editing guidance

- Prefer adding markdown under the right collection over inventing new storage.
- Keep frontmatter aligned with schema; drafts stay out of public lists.
- Nested KB paths use `[...slug]` — preserve folder structure from Obsidian when possible.
