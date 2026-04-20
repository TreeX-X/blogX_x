# 📝 BlogX_x 项目需求文档 (PRD)

## 1. 🎯 项目概述 (The Vibe)
- **项目名称**: BlogX_x
- **核心目标**: 构建一个极速、现代的个人数字花园，用于沉淀长篇技术文章与碎片化学习笔记。
- **设计基调 (Design Vibe)**: 极简主义、黑白主题为主、排版优雅。注重阅读体验，类似 Notion 或 Vercel 的设计语言。
- **技术栈**: Astro (核心框架) + TailwindCSS (样式) + MDX (内容) + TypeScript (类型约束)。

## 2. 🧱 核心功能规范 (The Spec)

### 2.1 页面路由结构
- `/` - 首页 (个人简介 + 最近的 3 篇文章 + 最近的 3 条笔记)
- `/posts` - 博客文章列表页 (按时间倒序，支持简单的分页)
- `/posts/[slug]` - 博客文章详情页
- `/notes` - 碎片化笔记列表页 (类似时间轴的形式展示)
- `/about` - 关于我,可以设置头像

### 2.2 核心特性要求
- **深色模式支持**: 必须支持系统的 Dark/Light 模式无缝切换。
- **响应式设计**: 移动端优先，在手机上导航栏需收起为汉堡菜单。
- **SEO 与 Meta**: 每个页面必须有独立的 `<title>` 和 `<meta name="description">`。
- **代码高亮**: 文章内的代码块需支持语法高亮（推荐 Astro 默认的 Shiki）。

### 2.3 页面效果
- **鼠标移动效果**：鼠标移动，网页背景会有泛白的圆形光点跟随，增加交互感。
- **文章列表**：每篇文章以卡片形式展示，包含标题、发布日期、描述和标签。卡片悬停时有轻微的放大和阴影效果。
- **文章详情**：文章内容以 Markdown 格式渲染，支持标题、段落、图片、代码块等。文章顶部显示标题、发布日期和标签。

### blog logo
- **博客 Logo**: 在网页标签页显示logo：/public/logo/treeXLogo.png


### Vercel 部署 和 LanceDB 接入

- **部署**: 项目完成后需部署到 Vercel，确保生产环境无错误。
- **LanceDB 接入**: 未来计划将文章和笔记数据同步
到 LanceDB，便于后续的 AI 搜索和推荐功能开发
- **数据同步**: 需要设计一个简单的脚本或 API 接口，将 Markdown 文件中的内容同步到 LanceDB，确保数据的一致性和实时更新.

### 知识图谱功能

库：react-force-graph
利用 LanceDB 的向量检索功能，寻找与它最相似的 3~5 篇文章或笔记，构建一个简单的知识图谱，展示它们之间的关系和相似度。
设置相似度阈值，或者限制每篇文章最多只连 5 条线
响应式兼容：手机端加载直接隐藏图谱的显示
知识图谱显示在主页的侧边栏


## 3. 🗄️ 数据结构定义 (Data Spec - Content Collections)
*这是给 AI 编写代码时最重要的约束规范。*

### 3.1 博客文章 (`src/content/posts/`)
Frontmatter (YAML) 数据验证模型需包含：
- `title` (String, 必填): 文章标题
- `date` (Date, 必填): 发布日期
- `description` (String, 必填): SEO 描述与列表页摘要
- `tags` (Array<String>, 可选): 标签，如 `['astro', '前端']`
- `coverImage` (String, 可选): 封面图相对路径
- `isDraft` (Boolean, 默认 false): 是否为草稿（草稿不应在生产环境展示）

### 3.2 碎片笔记 (`src/content/notes/`)
Frontmatter (YAML) 数据验证模型需包含：
- `date` (Date, 必填): 记录时间
- `mood` (String, 可选): 心情/状态图标，如 `💡`, `🐛`, `🎉`
- (注意：笔记不需要标题，直接渲染正文即可)

## 4. 🚀 开发里程碑 (Milestones)
*用于指导 AI 一步一步完成构建，避免一次性生成太多导致失控。*

- [ ] **Phase 1: 基础设施建设**
  - 初始化 TailwindCSS。
  - 配置 `src/content/config.ts` 以满足上述数据结构约束。
  - 创建全局 Layout (`src/layouts/BaseLayout.astro`)，包含基础的 Header 和 Footer。
- [ ] **Phase 2: 内容渲染机制**
  - 在 `src/content/posts` 下创建两篇测试 Markdown。
  - 完成文章列表页 (`/posts`) 的数据获取和 UI 渲染。
  - 完成文章详情页 (`/posts/[slug]`) 的动态路由与 Markdown 解析。
- [ ] **Phase 3: 首页与视觉优化 (Vibe Polish)**
  - 完善首页 (`/`) 的布局，拉取文章和笔记的聚合数据。
  - 调整字体排版 (Typography)、间距，添加微交互动画。
- [ ] **Phase 4: 部署与上线**
  - 检查所有内部链接。
  - 部署到 github 发布 gh-pages。
  - 在 README.md 中添加部署后的访问链接。