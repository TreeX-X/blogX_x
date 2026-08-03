# 📝 BlogX_x 产品需求文档 (PRD)

> **版本**: v2.0（已根据当前工程实现更新）
> **更新日期**: 2026-07-29
> **说明**: 本文档为产品总览。工程细节以 `wiki/`（仓库根 `wiki/` 目录）为当前真相源，不以下文为准。

## 1. 🎯 项目概述 (The Vibe)

- **项目名称**: BlogX_x
- **核心目标**: 构建一个极速、现代的个人数字花园，沉淀长篇技术文章、碎片化学习笔记与本地知识库，并以 AI 检索 + 知识图谱作为内容的发现层。
- **设计基调 (Design Vibe)**: 暖纸 (warm paper) + 牛血红 (oxblood red) 主题，参考 ljj.world；蓝图网格背景、玻璃面板、小圆角 (4–8px)；首页「树码空间」像素波动标题 (`PixelWaveTitle`)。light-only，强排版、低干扰阅读。> 历史版本的「极简黑白」基调已被产品方向更新取代。
- **技术栈**: Astro 6（`output: "server"`，`@astrojs/vercel` 适配器）+ React 19（交互岛屿）+ TypeScript + Tailwind CSS 4 + `astro:content` 内容集合。
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

`/admin`（hub）及其子页：`ideas`、`messages`、`posts`、`projects`、`repos`、`skills`、`toolbox`。认证见 `src/lib/admin-auth.ts`。

### 2.3 核心特性

- **AI 搜索**: 基于 LanceDB 向量检索 + GLM（如 GLM-4.5-AIR）生成回答与结果卡片；`/api/ai-search` 支持 `site`（默认）与 `toolbox` 两种 scope；按 IP 内存限频。
- **知识图谱**: 由向量相似度生成节点/边；`react-force-graph-2d` + d3-force 渲染；**仅桌面端**，移动端隐藏。阈值由 `KG_*` 环境变量控制。
- **文章外链采集 + 翻译**: posts 以 `sourceUrl` 为中心；构建时 `fetch-articles.mjs` 抓取正文并 LLM 全文翻译，存入 LanceDB `articles` 表；详情页支持中英切换。详见 `docs/content-layout-prd.md` Part A。
- **Obsidian 同步**: `scripts/sync-obsidian-kb.mjs` 将本地 Obsidian vault 同步到 `src/content/knowledge-base`；`pre-commit`/`pre-push` 钩子保证一致性。
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

> 真相源：`src/content.config.ts`；读取助手：`src/lib/content.ts`。下为摘要，字段以源码为准。

| 集合 | 路径 | 列表/详情路由 |
|------|------|---------------|
| `posts` | `src/content/posts/**` | `/posts`、`/posts/[slug]` |
| `knowledgeBase` | `src/content/knowledge-base/**` | `/knowledge-base`、`/knowledge-base/[...slug]` |
| `wiki` | `src/content/wiki/**` | `/wiki/[...slug]` |
| `repos` | `src/content/repos/**` | `/repos` |
| `skills` | `src/content/skills/**` | `/skills`、`/skills/[slug]` |
| `projects` | `src/content/projects/**` | admin + 目录 |

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
| `isDraft` | 默认 `false` | 公开列表过滤草稿 |

构建时可经 `fetch-articles.mjs` 抓取/翻译。

### 3.2 knowledgeBase / wiki

可选：`title`、`date`、`description`、`tags`、`isDraft`（默认 false）。知识库主要由 Obsidian 同步填充。

### 3.3 repos / skills / projects

- `repos`：必填 `title`、`repoUrl`、`description`；可选 `language`、`tags`、`stars`、`isDraft`。
- `skills`：必填 `title`、`description`、`skillDir`；可选 `tags`、`version`、`author`、`license`、`isDraft`；压缩包位于 `public/skills-download/`，由 `pack-skills.mjs` 打包。
- `projects`：必填 `title`、`repoUrl`、`description`；可选 `tags`、`isDraft`。

## 4. 🚀 构建流水线 (npm scripts)

| Script | 作用 |
|--------|------|
| `dev` | `astro dev` |
| `prebuild` | `pack-skills.mjs` |
| `build` | `init-db` → `fetch-articles --translate` → `astro build` |
| `sync-kb` / `sync-kb:stage` / `sync-kb:check` | Obsidian → content |
| `init-db` | 重建向量索引 |
| `mcp:kb` / `mcp:kb:http` | MCP server |
| `fetch-articles[:translate]` | 抓取/翻译外链文章 |
| `maintenance[:status\|:fix\|:verify]` | 运维助手 |
| `test:kg` | 知识图谱冒烟测试 |

CI（`.github/workflows/vector-sync.yml`）在内容/脚本/依赖变更时重建云端向量索引。

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