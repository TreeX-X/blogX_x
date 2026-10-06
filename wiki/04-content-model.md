# 04 — Content Model

Source of truth for schemas: `src/lib/content-schemas.ts`（唯一定义处，`astro/zod`，Astro 与 Node 双端可加载）。  
Shared read helpers: `src/lib/content.ts`。  
Content storage: `src/lib/content-store.ts` — LanceDB `content` 表的唯一读写入口。

## 两层：`content` 表与 `src/content/**`

| 层 | 是什么 | 谁写 |
|----|--------|------|
| LanceDB `content` 表 | **内容唯一真源**。字段：`collection` / `path` / `frontmatter`（JSON 字符串）/ `body` / `originalBody` / `translatedBody` / `status` / `updatedAt` | dev 面板、`content:intake`、`content:publish`、`sync-obsidian-kb --to-lancedb`、`fetch-articles` |
| `src/content/**` | **构建产物**。`scripts/content-pull.mjs` 在 `predev` / `prebuild` 把 `status: published` 的记录按原嵌套路径写盘并生成 frontmatter；`.gitignore` 忽略，不入 git | 只有 content-pull |

`status: draft` 只存在于 `content` 表，不写盘，因此天然不进构建产物。草稿跨机器可见，
不依赖本地文件。`frontmatter.isDraft` 是 glob loader 时代的遗留物，不再作为草稿口径。

克隆一台新机器只需要 `.env`（`LANCEDB_*`、`GLM_API_KEY`、`UPSTASH_*`）+ `npm install`：
`prebuild` 的 `content-pull` 会拉全量内容。本机没有 Obsidian vault 不影响构建与管理。

## Collections

| Collection key | 表内 path | 构建期磁盘路径 | List/detail routes |
|----------------|-----------|----------------|--------------------|
| `posts` | 文件名去扩展名 | `src/content/posts/**` | `/posts`, `/posts/[slug]` |
| `knowledgeBase` | 集合内相对路径，可嵌套 | `src/content/knowledge-base/**` | `/knowledge-base`, `/knowledge-base/[...slug]` |
| `wiki` | 同上 | `src/content/wiki/**` | `/wiki/[...slug]` |
| `repos` | 文件名去扩展名 | `src/content/repos/**` | `/repos` |
| `skills` | 文件名去扩展名 | `src/content/skills/**` | `/skills`, `/skills/[slug]` |
| `projects` | 文件名去扩展名 | `src/content/projects/**` | admin + catalog usage |
| `toolbox` | — | 不经 glob loader，`src/lib/toolbox.ts` 直接读 `content` 表 | `/toolbox` |

`path` 是集合内相对路径（正斜杠、不含扩展名），允许中文、全角冒号、圆括号、空格与嵌套目录。
写盘时 `content-pull` 会拒绝越出集合目录的 `path`（`../` 穿越）——那属于数据错误，让构建失败。

All glob loaders: `glob({ pattern: '**/*.md', base: '...' })`。

## Schemas (summary)

`z` 来自 `astro/zod`（Node 直跑的脚本也能加载同一份定义）。面板写入走 passthrough 版校验，
为的是留住 schema 之外的键——posts 的 `fetched`、knowledgeBase 的 `source` 由脚本写入，
面板从不构造它们，静默丢弃就是丢数据。

### posts

| Field | Required | Notes |
|-------|----------|-------|
| `sourceUrl` | **yes** | External article URL |
| `title` | no | Auto-extract if missing |
| `date` | no | Coerced date / fallback from id |
| `description` | no | SEO / cards |
| `tags` | no | string[] |
| `coverImage` | no | |
| `originalAuthor` | no | |
| `originalLang` | default `en` | |
| `isDraft` | default `false` | 遗留字段，草稿权威口径是记录的 `status` |

双语正文不进 frontmatter，走记录自己的两列：`originalBody`（原文，抓取下来是 HTML）、
`translatedBody`（译文 Markdown）、`body`（与译文一致，content-pull 据此写盘做降级渲染）。
抓取期元数据（title/description/author/coverImage/wordCount/contentHash/fetchedAt/
translatedAt/fetchStatus）并入 `frontmatter.fetched` 子对象，`src/lib/article-db.ts` 优先读
`fetched.*`，读不到才回退 frontmatter 顶层。刷新入口：`npm run fetch-articles`。

intake 通道（面板 / `content:intake`）产出的 posts 草稿还带 `frontmatter.intake`
（`source` / `status` / `warnings` / `at`）：提取或翻译失败时原因随草稿可见，发布前可人工修订。

### knowledgeBase / wiki

Optional: `title`, `date`, `description`, `tags`, `isDraft` (default false)。  
KB 的主要来源是 Obsidian  vault，但**只能按条目导入**：`npm run sync-kb` 列候选，
`npm run sync-kb:import -- --only "<相对路径>"` 写 content 表。整库导入已禁用（vault 含未发布
的私人笔记，见 `wiki/07-pipeline-mcp.md`）。导入的条目带 `source: obsidian:<相对路径>`。

### repos

Required: `title`, `repoUrl`, `description`。  
Optional: `language`, `tags`, `stars`, `isDraft`。

### skills

Required: `title`, `description`, `skillDir`。  
Optional: `tags`, `version`, `author`, `license`, `isDraft`。  
Zips often under `public/skills-download/`; packed by `scripts/pack-skills.mjs`。

### projects

Required: `title`, `repoUrl`, `description`。  
Optional: `tags`, `isDraft`。

### toolbox

Required: `name`, `url`, `category`。Optional: `summary` (default `""`), `icon`。

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
| `src/lib/toolbox.ts` | toolbox 集合的读取入口（不经 glob loader，直读 content 表） |
| `src/lib/article-db.ts` | posts 详情页的双语正文与抓取期元数据读取 |
| `src/lib/article-intake.service.ts` | 抓取、富媒体翻译、GLM 提取、校验发布的唯一实现 |
| LanceDB `blog_index` | 搜索/图谱用的内容派生索引（`scripts/init-db.mjs` 重建） |

## Editing guidance

- 内容一律通过 content 表编辑：dev 面板、`content:intake` / `content:publish`、`sync-obsidian-kb --to-lancedb`、`fetch-articles`。**不要手动改 `src/content/**`**——那是构建产物，下次 `content-pull` 会被覆盖或清掉。
- 想让条目下线：把记录 `status` 改成 `draft`（面板或 `content:publish` 的撤回路径），而不是删文件。
- 新增集合必须同时登记 `src/lib/content-schemas.ts` 与 `src/content.config.ts`（toolbox 例外，只登记 schema）。
