# 📝 BlogX_x 产品需求文档 (PRD)

> **版本**: v2.1（2026-10-06 按内容云化后的工程实现更新）
> **更新日期**: 2026-10-06
> **说明**: 本文档为产品总览。工程细节以 `wiki/`（仓库根 `wiki/` 目录）为当前真相源，不以下文为准。

## 1. 🎯 项目概述 (The Vibe)

- **项目名称**: BlogX_x
- **核心目标**: 构建一个极速、现代的个人数字花园，沉淀长篇技术文章、碎片化学习笔记与本地知识库，并以 AI 检索 + 知识图谱作为内容的发现层。
- **设计基调 (Design Vibe)**: 暖纸 (warm paper) + 牛血红 (oxblood red) 主题，参考 ljj.world；蓝图网格背景、玻璃面板、小圆角 (4–8px)；首页「树码空间」像素波动标题 (`PixelWaveTitle`)。light-only，强排版、低干扰阅读。> 历史版本的「极简黑白」基调已被产品方向更新取代。
- **技术栈**: Astro 6（`output: "server"`，`@astrojs/vercel` 适配器）+ React 19（交互岛屿）+ TypeScript + Tailwind CSS 4 + `astro:content` 内容集合。**内容不在 git 里**：真源是 LanceDB Cloud 单表 `content`，`src/content/**` 由 `scripts/content-pull.mjs` 在 predev/prebuild 从表里生成，是构建产物。
- **Node**: `>= 22.12.0`
- **部署**: Vercel。

## 2. 🧱 核心功能规范 (The Spec)

### 2.1 页面路由结构（公开页）

| 路由 | 说明 |
|------|------|
| `/` | 首页：Hero + AI 搜索 + 最近文章/知识库 + 知识图谱（仅桌面） |
| `/posts` | 文章列表页（按收录日期倒序） |
| `/posts/[slug]` | 文章详情页（多为外链收藏 + 中英翻译） |
| `/knowledge-base` | 知识库列表页（分类侧栏 + 锚点跳转） |
| `/knowledge-base/[...slug]` | 知识库详情页（嵌套路径，由 Obsidian 同步） |
| `/wiki/[...slug]` | 站点内容 wiki（`src/content/wiki`，区别于工程 wiki） |
| `/repos` | 仓库目录 |
| `/skills` / `/skills/[slug]` | Skills 列表与详情（含下载） |
| `/toolbox` | 外部工具导航页 |
| `/about` | 关于页 + 趣味留言墙 + 点子收集箱 |

### 2.2 管理后台

`/admin`（hub）及其子页：`ideas`、`messages`、`posts`、`projects`、`repos`、`skills`、`toolbox`、`knowledge-base`、`wiki`。认证见 `src/lib/admin-auth.ts`。

**生产环境下 `/admin` 与 `/api/admin` 一律 404**（`src/middleware.ts`）：公网写入面为零。管理与导入都在持有密钥的机器上、以 dev 模式或 CLI 进行，读写一律走 `src/lib/content-store.ts`（`content` 表的唯一入口）。

### 2.3 核心特性

- **AI 搜索**: 基于 LanceDB 向量检索 + GLM（如 GLM-4.5-AIR）生成回答与结果卡片；`/api/ai-search` 支持 `site`（默认）与 `toolbox` 两种 scope；按 IP 内存限频。
- **知识图谱**: 由向量相似度生成节点/边；`react-force-graph-2d` + d3-force 渲染；**仅桌面端**，移动端隐藏。阈值由 `KG_*` 环境变量控制。
- **文章外链采集 + 翻译**: posts 以 `sourceUrl` 为中心；`npm run fetch-articles`（默认只补缺，`--force` 全部重来）按 `sourceUrl` 抓取并 LLM 全文翻译，双语正文写进 `content` 表的 posts 记录（`originalBody` / `translatedBody`）；详情页支持中英切换。抓取与翻译的唯一实现是 `src/lib/article-intake.service.ts`，与 AI 上传通道共用。详见 `docs/content-layout-prd.md` Part A。
- **AI 上传处理通道**: 粘贴 URL / 上传文件 / 粘贴正文 → GLM 提取 frontmatter 与双语正文 → `content` 表 posts 草稿 → 校验后发布并触发 Vercel Deploy Hook。CLI（`npm run content:intake` / `content:publish`）与 dev 面板共用同一份实现。
- **Obsidian 导入（按条目）**: `scripts/sync-obsidian-kb.mjs` 把 vault 笔记写入 `content` 表 `knowledgeBase` 集合。`npm run sync-kb` 列候选、`npm run sync-kb:import -- --only "<相对路径>"` 逐条导入；**整库自动同步已禁用**（vault 含未发布的私人笔记）。没有 vault 的机器不影响构建与管理。
- **留言 / 点子**: 关于页互动模块（趣味留言墙 + 点子收集箱），`@vercel/kv` 持久化，AI 审核 + 管理员审核。详见 `docs/message-prd.md`。
- **工具箱**: 静态维护的外部工具导航，复用 AI 搜索。详见 `docs/toolBox-prd.md`。
- **MCP**: 暴露本地 MCP server（stdio / HTTP）供 Agent 访问知识库/wiki。详见 `docs/mcp-knowledge-base.md`。
- **响应式设计**: 移动端优先，断点 `≤700px` / `701–1024px` / `≥1025px`；导航在移动端收起。
- **SEO 与 Meta**: 每页独立 `<title>` 与 `<meta name="description">`。
- **代码高亮**: 文章内代码块支持语法高亮。

### 2.4 页面效果

- 鼠标移动时背景有泛白圆形光点跟随，增加交互感。
- 文章列表卡片含标题、日期、描述、标签；悬停轻微放大与阴影。
- 文章详情支持标题、段落、图片、代码块等。

### 2.5 博客 Logo

网页标签页 logo：`/public/logo/treeXLogo.png`。

## 3. 🗄️ 数据结构定义 (Content Collections)

> 真相源：LanceDB `content` 表（`collection` / `path` / `frontmatter`(JSON) / `body` / `originalBody` / `translatedBody` / `status` / `updatedAt`）。schema 唯一定义处是 `src/lib/content-schemas.ts`；读取助手：`src/lib/content.ts`。下为摘要，字段以源码为准。
>
> `src/content/**` 是构建产物：`scripts/content-pull.mjs` 在 predev/prebuild 把 `status: published` 的记录按原嵌套路径写盘，`draft` 不写盘，目录不入 git。

| 集合 | 表内 path | 构建期磁盘路径 | 列表/详情路由 |
|------|-----------|----------------|---------------|
| `posts` | 文件名去扩展名 | `src/content/posts/**` | `/posts`、`/posts/[slug]` |
| `knowledgeBase` | 集合内相对路径（可嵌套） | `src/content/knowledge-base/**` | `/knowledge-base`、`/knowledge-base/[...slug]` |
| `wiki` | 同上 | `src/content/wiki/**` | `/wiki/[...slug]` |
| `repos` | 文件名去扩展名 | `src/content/repos/**` | `/repos` |
| `skills` | 文件名去扩展名 | `src/content/skills/**` | `/skills`、`/skills/[slug]` |
| `projects` | 文件名去扩展名 | `src/content/projects/**` | admin + 目录 |
| `toolbox` | — | 不经 glob loader，`src/lib/toolbox.ts` 直读 `content` 表 | `/toolbox` |

### 3.1 posts（外链文章）

| 字段 | 必填 | 说明 |
|------|------|------|
| `sourceUrl` | ✅ | 原文链接 |
| `title` | 可选 | 缺省自动抓取 |
| `date` | 可选 | 缺省从 id 解析或当天 |
| `description` | 可选 | SEO / 卡片 |
| `tags` | 可选 | string[] |
| `coverImage` | 可选 | |
| `originalAuthor` | 可选 | |
| `originalLang` | 默认 `en` | |
| `isDraft` | 默认 `false` | 遗留字段；草稿权威口径是记录的 `status` |

双语正文不进 frontmatter，走记录自己的两列：`originalBody`（原文）、`translatedBody`（译文）、
`body`（与译文一致，content-pull 据此写盘）。抓取期元数据并入 `frontmatter.fetched`。
可经 `npm run fetch-articles` 抓取/翻译（默认只补缺，`--force` 全部重来）。

### 3.2 knowledgeBase / wiki

可选：`title`、`date`、`description`、`tags`、`isDraft`（默认 false）。知识库主要来自 Obsidian
vault，但只能按条目导入（`npm run sync-kb:import -- --only "<相对路径>"`），禁止整库自动同步。
导入条目带 `source: obsidian:<相对路径>`。

### 3.3 repos / skills / projects

- `repos`：必填 `title`、`repoUrl`、`description`；可选 `language`、`tags`、`stars`、`isDraft`。
- `skills`：必填 `title`、`description`、`skillDir`；可选 `tags`、`version`、`author`、`license`、`isDraft`；压缩包位于 `public/skills-download/`，由 `pack-skills.mjs` 打包。
- `projects`：必填 `title`、`repoUrl`、`description`；可选 `tags`、`isDraft`。

## 4. 🚀 构建流水线 (npm scripts)

| Script | 作用 |
|--------|------|
| `dev` | `astro dev`（`predev` 先 content-pull） |
| `prebuild` | `content-pull.mjs` + `pack-skills.mjs` |
| `build` | `init-db` → `fetch-articles`（只补缺）→ `astro build` |
| `content:pull` | content 表 → `src/content/**`（构建期写盘） |
| `content:migrate` | 一次性迁移（遗留 `src/content` → content 表），应急用 |
| `content:intake` / `content:publish` | AI 上传 → 草稿 / 校验发布 + Deploy Hook |
| `sync-kb` / `sync-kb:import` | Obsidian vault 候选清单 / 按条目导入 content 表 |
| `init-db` | 重建向量索引 |
| `mcp:kb` / `mcp:kb:http` | MCP server |
| `fetch-articles` | 刷新 posts 双语正文（默认补缺，`--force` 全部） |
| `maintenance[:status\|:fix\|:verify]` | 运维助手 |
| `test:kg` | 知识图谱冒烟测试 |

内容真相源是 LanceDB `content` 表；`src/content/**` 不入 git。一台干净机器 clone + 配好 `.env`
即可 `npm run build` 出完整站点，不需要本机 Obsidian vault。CI（`.github/workflows/vector-sync.yml`）
在 `init-db.mjs` / `package.json` / lockfile 变更时重建云端向量索引。

## 5. 📚 文档索引

| 文档 | 覆盖范围 |
|------|---------|
| `docs/content-layout-prd.md` | 文章外链采集与翻译 + 布局与知识库阅读体验 |
| `docs/message-prd.md` | 留言 / 点子互动模块 |
| `docs/toolBox-prd.md` | 工具箱导航页 |
| `docs/mcp-knowledge-base.md` | 知识库 MCP server |
| `docs/ljj-world-design-extraction.md` | 主题设计提取（独立维护） |
| `wiki/*.md` | 工程上下文 wiki（当前真相源） |

## 6. 🧭 开发里程碑 (历史)

- ✅ Phase 1: 基础设施（Tailwind、content config、BaseLayout）
- ✅ Phase 2: 内容渲染机制（文章列表/详情）
- ✅ Phase 3: 首页与视觉优化
- ✅ Phase 4: 部署上线
- ✅ Phase 5: AI 搜索 + 知识图谱 + LanceDB
- ✅ Phase 6: 文章外链采集 + 翻译 + 布局/知识库优化
- ✅ Phase 7: 留言/点子模块 + 管理后台套件 + 工具箱 + MCP + Obsidian 同步
- ✅ Phase 8 (2026-10): 内容云化 —— 真源迁出仓库至 LanceDB `content` 单表；公网写入面撤销（`/admin`、`/api/admin` 生产 404）；管理入口为 CLI 与 dev-only 面板；AI 上传处理通道；构建期从 `content` 表拉取写盘；Obsidian 降级为按条目可选输入源
- ⏳ 延后: 私有内容备份仓（全量内容 + git 历史，`content:restore` 还原）— 见 `wiki/` 与 `.agents/notes/`