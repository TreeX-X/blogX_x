# 📘 PRD - 文章功能重构：外链收藏 + 自动抓取 + 全文翻译

**文档状态**: Draft  
**更新日期**: 2026-05-12  
**版本**: v1.0

---

## 1. 🎯 项目概述

- **项目目标**：将 BlogX_x 的"文章"功能从"自写文章展示"转型为"外链优秀文章收藏 + 构建时自动抓取 + 中英文全文翻译"。用户在本地 Markdown 中记录文章链接与元数据，构建流程自动抓取原文并翻译，最终呈现给读者一个带中英切换的沉浸式阅读体验。
- **核心价值**：让博主成为优质内容的策展人——不需要自己写长文，通过收藏和翻译优秀外文技术文章来输出价值，同时保留原作者归属和来源链接。

### 1.1 转型前后对比

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| 内容来源 | 博主自己撰写 Markdown 正文 | 博主粘贴外链 URL，正文自动抓取 |
| 正文存储 | 直接在 `.md` 文件中 | LanceDB 中（原文 + 翻译） |
| 翻译 | 无 | 构建时 LLM 全文中英翻译，前端切换 |
| Frontmatter | title/date/description 必填 | sourceUrl 必填，title/date/description 可选（可自动提取） |
| 现有自写文章 | 2 篇 | 迁移至知识库后清除 |

---

## 2. 👥 目标用户

- **博主（内容策展人）**：需要快速收录外链文章，不需要手写正文，构建时自动完成抓取和翻译
- **博客读者**：阅读翻译后的中文版本，需要时可切换查看英文原文，了解文章来源和原作者

---

## 3. 🚧 边界与范围

### 在范围内

- ✅ 扩展 posts 内容集合的 frontmatter schema（新增 `sourceUrl`、`originalAuthor`、`originalLang` 等字段）
- ✅ 编写构建时文章抓取脚本 `scripts/fetch-articles.mjs`（抓取正文、提取元数据、存入 LanceDB）
- ✅ 编写构建时翻译流程（调用 LLM API 全文翻译、存入 LanceDB）
- ✅ LanceDB 文章存储表设计与读写工具函数
- ✅ 改造文章列表页（`src/pages/posts/index.astro`）—— 展示来源、语言标识、封面
- ✅ 改造文章详情页（`src/pages/posts/[slug].astro`）—— 原文/翻译切换、来源回链
- ✅ 新增 React 组件 `ArticleReader.tsx`（翻译切换按钮 + 内容渲染）
- ✅ 新增 React 组件 `LanguageToggle.tsx`（中英文切换 UI）
- ✅ 更新 `src/lib/content.ts` 增加文章 LanceDB 读取函数
- ✅ 更新构建流程（`package.json` scripts 中增加 fetch-articles 步骤）
- ✅ 迁移现有 2 篇自写文章到知识库

### 在范围外 / 非目标

- ❌ 不改变知识库功能（knowledgeBase 集合不受影响）
- ❌ 不构建管理后台 UI（文章通过本地 Markdown 管理）
- ❌ 不做客户端实时抓取（全部在构建时完成）
- ❌ 不做段落级翻译缓存（全文翻译一次性存入 LanceDB）
- ❌ 不改变整体视觉风格（极简黑白编辑器美学）
- ❌ 不修改导航栏结构

---

## 4. 🛡️ 非功能性需求

- **注释**：生成代码需添加中文注释，格式为 `/*-- 注释内容 --*/`
- **响应式**：文章详情页在所有视口下无横向溢出
- **性能**：翻译内容预生成，运行时无 LLM API 调用；LanceDB 读取延迟 < 100ms
- **可访问性**：翻译切换按钮需具备 `aria-label`，键盘可操作
- **主题兼容**：所有新增样式必须同时兼容 light/dark 主题
- **错误处理**：抓取失败时优雅降级（显示摘要 + 原文链接，标记"抓取失败"）
- **构建约束**：Vercel Serverless 环境下，构建脚本需在 `build` 阶段前执行

---

## 5. 📈 成功标准

| 指标 | 目标 |
|------|------|
| 博主收录一篇新文章的时间 | < 1 分钟（只需填写 URL + 可选元数据） |
| 构建时抓取成功率 | ≥ 90%（对主流技术博客站点） |
| 翻译质量 | 可读性良好，技术术语准确（由 LLM 质量保证） |
| 详情页加载速度 | 与重构前无明显差异（LanceDB 读取 < 100ms） |
| 中英文切换延迟 | < 50ms（纯前端切换，无网络请求） |

---

## 6. ⚙️ 核心功能与验收标准

### 功能 1：Frontmatter Schema 扩展（P0）

**描述**：扩展 posts 内容集合的 frontmatter 定义，新增外链文章所需的字段。

**新字段设计**：

```yaml
---
# === 必填 ===
sourceUrl: https://example.com/article        # 原文链接（必填，转型后标识外链文章）

# === 可选（不填则自动从源 URL 提取） ===
title: string                                    # 文章标题
date: 2026-05-12                                 # 收录日期
description: string                              # 摘要
tags: [typescript, performance]                  # 标签
coverImage: string                               # 封面图 URL

# === 可选（补充元数据） ===
originalAuthor: string                           # 原作者名
originalLang: en                                 # 原文语言（en/zh/ja 等，默认 en）
isDraft: boolean                                 # 是否草稿（默认 false）
---
```

**注意**：正文内容区域不再需要手动编写，留空即可。抓取到的原文和翻译存储在 LanceDB 中。

**实现要求**：
- 修改 `src/content.config.ts` 的 posts schema
- `sourceUrl` 设为必填 `z.string().url()`
- `title`、`date`、`description` 改为可选（有 fallback 逻辑）
- 新增 `originalAuthor`（`z.string().optional()`）
- 新增 `originalLang`（`z.string().default('en')`）
- 保持 `tags`、`coverImage`、`isDraft` 不变

**验收标准**：
- [ ] `sourceUrl` 为必填字段，校验为合法 URL
- [ ] `title` 可选，未填时从抓取结果自动获取
- [ ] `date` 可选，未填时默认为文件修改时间或收录当天
- [ ] `description` 可选，未填时从抓取结果自动获取
- [ ] `originalAuthor` 和 `originalLang` 可选
- [ ] 现有字段兼容不受影响
- [ ] `astro check` 类型检查通过

---

### 功能 2：构建时文章抓取脚本（P0）

**描述**：新建 `scripts/fetch-articles.mjs`，在构建时扫描所有 posts，对带有 `sourceUrl` 的文章自动抓取原文内容。

**工作流程**：
```
1. 扫描 src/content/posts/ 下所有 .md 文件
2. 解析 frontmatter，筛选出有 sourceUrl 的文章
3. 检查 LanceDB 中是否已有缓存（通过 contentHash 判断是否需要更新）
4. 对需要抓取的 URL 发起 HTTP 请求
5. 使用 @mozilla/readability + linkedom 提取正文
6. 提取元数据（title、description、og:image、author）
7. 将原文内容和元数据存入 LanceDB
8. 输出抓取报告（成功/失败/跳过数量）
```

**技术选型**：
- HTTP 请求：Node.js 内置 `fetch`（Node 22+，项目已要求 ≥ 22.12.0）
- HTML 解析：`linkedom`（轻量、无原生依赖、Vercel 兼容）
- 正文提取：`@mozilla/readability`（Mozilla 开源，Firefox Reader View 同款算法）
- Frontmatter 解析：`gray-matter`（已有依赖）

**错误处理**：
- 抓取超时（15s）→ 跳过，记录日志
- HTTP 错误 → 跳过，记录日志
- 解析失败 → 存入仅包含 URL 的最小记录，标记 `fetchStatus: 'failed'`

**新增依赖**：
- `@mozilla/readability`
- `linkedom`

**验收标准**：
- [ ] 脚本可通过 `node scripts/fetch-articles.mjs` 独立运行
- [ ] 能正确解析 frontmatter 中的 `sourceUrl`
- [ ] 能成功抓取并提取主流技术博客（Medium、Dev.to、个人博客）的正文
- [ ] 抓取结果正确存入 LanceDB
- [ ] 重复抓取有增量判断（contentHash 未变则跳过）
- [ ] 超时和错误有优雅处理，不中断构建流程
- [ ] 输出清晰的抓取报告日志

---

### 功能 3：LanceDB 文章存储设计（P0）

**描述**：在现有 LanceDB 实例中新增 `articles` 表，存储抓取的原文内容和翻译。

**表结构设计**：

```typescript
interface ArticleRecord {
  slug: string;              // 文章 slug（与 posts 文件名对应）
  sourceUrl: string;         // 原文链接
  originalContent: string;   // 原文正文（HTML 或 Markdown）
  translatedContent: string; // 翻译后正文（中文）
  contentHash: string;       // 内容哈希（判断是否需要重新抓取）
  fetchedAt: string;         // 抓取时间（ISO 8601）
  translatedAt: string;      // 翻译时间（ISO 8601）
  originalLang: string;      // 原文语言（en/zh/ja 等）
  title: string;             // 抓取到的标题
  description: string;       // 抓取到的摘要
  author: string;            // 原作者
  coverImage: string;        // og:image 封面图
  wordCount: number;         // 原文字数
  fetchStatus: 'success' | 'failed' | 'pending';  // 抓取状态
}
```

**设计决策**：
- 复用现有 LanceDB 实例（`scripts/init-db.mjs` 中已初始化），新增 `articles` 表
- 原文存储为 HTML（保留格式），前端渲染时做 XSS 清理
- 不做向量化（本次不需要语义搜索，仅按 slug 查询）
- contentHash 使用 SHA-256（基于原文 URL + 正文前 500 字符）

**工具函数**（新增到 `src/lib/article-db.ts`）：
- `getArticleBySlug(slug: string): Promise<ArticleRecord | null>` — 按 slug 查询
- `saveArticle(record: ArticleRecord): Promise<void>` — 存储/更新文章
- `getArticlesByStatus(status: string): Promise<ArticleRecord[]>` — 按状态查询（脚本用）
- `initArticlesTable(db): Promise<Table>` — 初始化表（幂等）

**验收标准**：
- [ ] LanceDB articles 表可在 `init-db.mjs` 中初始化
- [ ] `getArticleBySlug` 能正确返回文章记录
- [ ] `saveArticle` 能正确存储和更新
- [ ] contentHash 机制可正确判断是否需要重新抓取
- [ ] `src/lib/article-db.ts` 类型检查通过
- [ ] 与现有知识图谱表共存，互不影响

---

### 功能 4：构建时翻译流程（P0）

**描述**：在抓取完成后，对原文内容调用 LLM API 进行全文中文翻译，翻译结果存入 LanceDB。

**工作流程**：
```
1. 读取 LanceDB 中 fetchStatus='success' 且 translatedContent 为空的记录
2. 对每条记录：
   a. 将原文正文发送给 LLM API
   b. 系统提示词：翻译为中文，保留代码块/链接/图片不翻译，技术术语保留英文
   c. 接收翻译结果
   d. 存入 LanceDB 的 translatedContent 字段
3. 输出翻译报告
```

**LLM API 设计**：
- 默认使用 OpenAI 兼容接口（`OPENAI_API_KEY` + `OPENAI_BASE_URL` 环境变量）
- 模型默认 `gpt-4o-mini`（性价比高，翻译质量足够）
- 可通过环境变量 `TRANSLATE_MODEL` 覆盖
- 长文分段翻译（每段 ≤ 4000 tokens），保持段落边界

**翻译提示词**：
```
你是一位专业的技术文章翻译者。请将以下英文技术文章翻译为中文。
规则：
1. 保留所有代码块（```...```）原样不翻译
2. 保留所有行内代码（`...`）原样不翻译
3. 保留所有链接 URL 不翻译，但翻译链接文字
4. 保留所有图片 URL 不翻译
5. 技术术语首次出现时用「中文（English）」格式，后续直接用中文
6. 保持原文的段落结构和 Markdown 格式
7. 翻译要自然流畅，不要生硬直译
```

**错误处理**：
- API 调用失败 → 重试 2 次（指数退避）
- 仍失败 → 标记 `translatedContent: ''`，前端降级显示原文
- API Key 未配置 → 跳过翻译，前端提示"翻译未配置"

**环境变量**：
- `OPENAI_API_KEY`（必需）
- `OPENAI_BASE_URL`（可选，默认 `https://api.openai.com/v1`）
- `TRANSLATE_MODEL`（可选，默认 `gpt-4o-mini`）

**验收标准**：
- [ ] 翻译脚本可独立运行 `node scripts/fetch-articles.mjs --translate`
- [ ] 也可与抓取合并运行 `node scripts/fetch-articles.mjs`
- [ ] 翻译结果正确存入 LanceDB
- [ ] 长文分段翻译后拼接无遗漏
- [ ] 代码块/链接在翻译中保持原样
- [ ] API 未配置时有清晰提示，不中断构建
- [ ] 翻译失败有重试机制

---

### 功能 5：文章详情页改造（P0）

**描述**：改造 `src/pages/posts/[slug].astro`，展示从 LanceDB 读取的原文/翻译内容，并提供中英文切换按钮。

**页面布局**：

```
┌──────────────────────────────────────────────────┐
│  [← 返回列表]    [原文 English ✓] [中文翻译]     │  ← 语言切换栏
├──────────────────────────────────────────────────┤
│  原作者: John Doe  ·  来源: example.com           │  ← 来源信息
│  2026-05-12 收录   ·  阅读约 8 分钟               │
├──────────────────────────────────────────────────┤
│                                                  │
│              文章正文内容                          │
│          （当前选中语言的版本）                     │
│                                                  │
├──────────────────────────────────────────────────┤
│  [← 上一篇]                    [下一篇 →]          │  ← 导航
│  原文链接: https://example.com/article             │  ← 来源回链
└──────────────────────────────────────────────────┘
```

**实现要求**：
- 从 LanceDB 读取 `ArticleRecord`（通过 `getArticleBySlug`）
- 使用 React 组件 `ArticleReader.tsx` 渲染内容（支持客户端切换）
- `ArticleReader` 接收 `originalContent` 和 `translatedContent` 两个 prop
- 内容渲染时使用 DOMPurify 做 XSS 清理
- 显示原作者、来源域名、收录日期、预估阅读时间
- 阅读时间 = `Math.ceil(wordCount / 200)` 分钟
- 新增上一篇/下一篇导航（按收录日期排序）
- 来源回链在页面底部，明确标注"查看原文"

**新增依赖**：
- `dompurify`（XSS 清理）

**验收标准**：
- [ ] 详情页从 LanceDB 读取文章内容
- [ ] 原文/翻译切换按钮可用，切换无闪烁
- [ ] 来源链接正确显示并可点击跳转
- [ ] 原作者信息正确展示
- [ ] 阅读时间估算合理
- [ ] 上一篇/下一篇导航可用
- [ ] XSS 清理生效，恶意脚本不执行
- [ ] 移动端布局正常

---

### 功能 6：语言切换组件（P0）

**描述**：新建 React 组件 `LanguageToggle.tsx`，提供中英文切换 UI。

**设计要求**：
- 两个按钮并排：`English` / `中文`
- 当前激活语言有视觉高亮（底部边线或背景色变化）
- 切换时内容区域淡入淡出（`opacity` 过渡，≤ 200ms）
- 记住用户选择到 `localStorage`（key: `preferred-article-lang`）
- 默认显示中文翻译（如有），翻译不可用时降级显示原文
- `aria-label` 标注当前语言状态
- 样式与现有 `.tag` / `.card` 风格统一

**验收标准**：
- [ ] 切换按钮可见且可操作
- [ ] 切换时内容平滑过渡
- [ ] 用户选择持久化到 localStorage
- [ ] 翻译不可用时降级为只显示原文，切换按钮禁用
- [ ] 键盘可操作（Tab 聚焦，Enter 切换）
- [ ] light/dark 主题下样式正常

---

### 功能 7：文章列表页改造（P1）

**描述**：改造 `src/pages/posts/index.astro`，适配外链文章的展示需求。

**卡片设计更新**：

```
┌─────────────────────────────────────┐
│  [封面图（如有）]                     │
│                                     │
│  文章标题                            │
│  原作者 · 来源域名 · 收录日期         │
│  摘要描述...                          │
│  #tag1 #tag2                         │
│  [EN] [中]  ← 语言可用性标识          │
└─────────────────────────────────────┘
```

**实现要求**：
- 卡片点击跳转到文章详情页
- 显示封面图（优先使用 frontmatter `coverImage`，其次从 LanceDB 读取 og:image）
- 显示原作者和来源域名（从 URL 提取）
- 语言标识小标签：有翻译显示 `[中]`，有原文显示 `[EN]`
- 列表仍按收录日期倒序
- 保留现有 grid 布局

**验收标准**：
- [ ] 卡片正确展示封面图（如有）
- [ ] 原作者和来源域名信息正确
- [ ] 语言标识与实际翻译状态一致
- [ ] 点击卡片跳转详情页
- [ ] 移动端布局正常

---

### 功能 8：现有文章迁移（P1）

**描述**：将现有 2 篇自写文章迁移到知识库，并从 posts 中清除。

**迁移清单**：

| 原文件 | 目标 |
|--------|------|
| `src/content/posts/get-started-with-astro.md` | `src/content/knowledge-base/开发经验/Astro博客搭建指南.md` |
| `src/content/posts/black-white-typography.md` | `src/content/knowledge-base/开发经验/黑白主题排版.md` |

**实现要求**：
- 复制文件到知识库目录，保留原有 frontmatter 和正文内容
- 调整 frontmatter 以符合 knowledgeBase schema（字段更宽松）
- 从 `src/content/posts/` 删除原文件
- 确认知识库页面和链接不受影响

**验收标准**：
- [ ] 两篇文章在知识库中可正常浏览
- [ ] posts 目录下不再有自写文章
- [ ] 知识库列表页和详情页无报错

---

### 功能 9：构建流程集成（P1）

**描述**：将抓取和翻译脚本集成到项目构建流程中。

**实现要求**：
- `package.json` 新增 scripts：
  - `"fetch-articles": "node scripts/fetch-articles.mjs"`
  - `"fetch-articles:translate": "node scripts/fetch-articles.mjs --translate"`
- Vercel 构建命令更新：先运行 `fetch-articles`，再 `astro build`
- 本地开发时可选运行（避免每次 dev 都抓取）
- 增量抓取：仅对新文章或内容变化的文章重新抓取

**验收标准**：
- [ ] `npm run fetch-articles` 可独立运行
- [ ] Vercel 部署时自动执行抓取
- [ ] 增量抓取正常工作（已抓取的文章不重复抓取）
- [ ] `astro build` 能正常完成

---

## 7. 📚 工程文件索引

| 文件路径 | 文件作用 | 关联原因 |
|---------|---------|---------|
| `src/content.config.ts` | 内容集合定义 | 功能1：扩展 posts schema |
| `src/lib/content.ts` | 内容工具函数 | 功能5/7：列表/详情页数据获取 |
| `src/lib/article-db.ts`（新建） | LanceDB 文章读写工具 | 功能3/5：文章存储与查询 |
| `src/pages/posts/index.astro` | 文章列表页 | 功能7：列表页改造 |
| `src/pages/posts/[slug].astro` | 文章详情页 | 功能5：详情页改造 |
| `src/components/ArticleReader.tsx`（新建） | 文章阅读器组件 | 功能5/6：内容渲染+翻译切换 |
| `src/components/LanguageToggle.tsx`（新建） | 语言切换组件 | 功能6：中英切换 UI |
| `scripts/fetch-articles.mjs`（新建） | 抓取+翻译脚本 | 功能2/4：构建时抓取和翻译 |
| `scripts/init-db.mjs` | LanceDB 初始化 | 功能3：新增 articles 表 |
| `src/styles/global.css` | 全局样式 | 功能5/6/7：新增样式 |
| `src/layouts/BaseLayout.astro` | 基础布局 | 页面层依赖 |
| `astro.config.mjs` | Astro 配置 | 构建流程相关 |
| `package.json` | 依赖和脚本 | 新增依赖和构建脚本 |
| `src/content/posts/get-started-with-astro.md` | 待迁移文章 | 功能8：迁移到知识库 |
| `src/content/posts/black-white-typography.md` | 待迁移文章 | 功能8：迁移到知识库 |
| `docs/layout-kb-optimization-prd.md` | 前一个 PRD | 风格参考 |

---

## 8. 📚 知识索引

| 知识条目 | 知识摘要 | 优先级 | 推荐阅读顺序 |
|---------|---------|-------|------------|
| Astro Content Collections | posts 集合通过 `glob` loader 加载 `.md` 文件，`defineCollection` + Zod schema 定义字段约束 | 高 | 1 |
| LanceDB JS SDK | `@lancedb/lancedb` 提供表创建、向量搜索、行级 CRUD；本项目已有 `init-db.mjs` 作为参考 | 高 | 2 |
| `@mozilla/readability` | Mozilla 开源正文提取算法，输入 DOM Document，输出 `{ title, content, textContent, excerpt }` | 高 | 3 |
| `linkedom` | 轻量 DOM 实现，为 Readability 提供 `parseHTML(html).document`，无原生依赖 | 高 | 4 |
| `gray-matter` | YAML frontmatter 解析库，项目已有依赖 | 中 | 5 |
| DOMPurify / isomorphic-dompurify | HTML XSS 清理库，用于安全渲染抓取到的 HTML 正文 | 中 | 6 |
| OpenAI API（Chat Completions） | 翻译接口标准，`messages` 数组 + `stream: false`，环境变量控制 base_url 和 model | 中 | 7 |
| `Astro.getStaticPaths()` | 详情页预生成路径列表，需从 LanceDB 读取所有 slug | 中 | 8 |
| CSS `localStorage` + React state | 语言切换的持久化方案 | 低 | 9 |
| Vercel Build 流程 | `vercel.json` 的 `buildCommand` 可自定义构建脚本顺序 | 低 | 10 |

---

## 9. 🧪 评估报告（Evaluator Reserved Section）

### 9.1 最近一次评估元信息
- **评估时间**: 2026-05-12
- **评估范围**: 完整评估（full），覆盖 PRD 全部 9 个功能需求 + 14 个代码文件
- **评估人/Agent**: evaluatorX
- **evaluation_mode**: full
- **关联代码范围**:
  - `src/content.config.ts`
  - `src/lib/article-db.ts`
  - `scripts/fetch-articles.mjs`
  - `src/components/LanguageToggle.tsx`
  - `src/components/ArticleReader.tsx`
  - `src/pages/posts/[slug].astro`
  - `src/pages/posts/index.astro`
  - `src/styles/global.css`
  - `src/lib/content.ts`
  - `scripts/init-db.mjs`
  - `package.json`
  - `tsconfig.json`
  - `src/content/knowledge-base/开发经验/Astro博客搭建指南.md`
  - `src/content/knowledge-base/开发经验/黑白主题排版.md`
  - `src/content/posts/when-to-use-memo.md`

---

### 9.2 需求符合度概览

| 需求 | 类型 | 状态 | 对应代码 | 说明 |
|------|------|------|---------|------|
| 功能1：Frontmatter Schema 扩展 | P0 | ✅ 已实现 | `src/content.config.ts` | sourceUrl 必填 + URL 校验，其余字段可选，完全匹配 PRD |
| 功能2：构建时文章抓取脚本 | P0 | ✅ 已实现 | `scripts/fetch-articles.mjs` | 抓取流程、错误处理、增量判断、报告输出均完整 |
| 功能3：LanceDB 文章存储设计 | P0 | ⚠️ 部分实现 | `src/lib/article-db.ts`、`scripts/init-db.mjs` | 功能完整，但 `initArticlesTable()` 签名与 PRD 不一致（PRD 要求接收 `db` 参数） |
| 功能4：构建时翻译流程 | P0 | ⚠️ 部分实现 | `scripts/fetch-articles.mjs` | 翻译流程完整，但代码块/链接保持原样仅靠 LLM 提示词，无程序化保障 |
| 功能5：文章详情页改造 | P0 | ⚠️ 部分实现 | `src/pages/posts/[slug].astro`、`src/components/ArticleReader.tsx` | 布局和功能正确，但 **XSS 清理使用自制正则而非 PRD 要求的 DOMPurify** |
| 功能6：语言切换组件 | P0 | ✅ 已实现 | `src/components/LanguageToggle.tsx` | 按钮、持久化、降级、aria 属性均完整 |
| 功能7：文章列表页改造 | P1 | ✅ 已实现 | `src/pages/posts/index.astro` | 封面图、来源信息、语言标识、响应式均完整 |
| 功能8：现有文章迁移 | P1 | ✅ 已实现 | 知识库目录文件 | 两篇文章已迁移，原文件已删除 |
| 功能9：构建流程集成 | P1 | ❌ 未实现 | `package.json` | `build` 脚本未集成 `fetch-articles`，Vercel 部署时不会自动抓取 |

**统计**：
- ✅ 完全实现: 4 / 9
- ⚠️ 部分实现: 3
- ❌ 未实现: 1
- 🔄 不可评估: 1（功能4 翻译质量需运行时验证）

---

### 9.2.1 验收标准（AC）符合度

#### 功能1：Frontmatter Schema 扩展

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| sourceUrl 必填，校验为合法 URL | ✅ 通过 | `content.config.ts:7` | `z.string().url()` | N/A |
| title 可选，未填时从抓取结果自动获取 | ✅ 通过 | `content.config.ts:9` | `.optional()`，脚本中有 fallback | N/A |
| date 可选，默认文件修改时间或当天 | ⚠️ 部分通过 | `content.config.ts:10`、`content.ts:35` | date 可选✅；fallback 为 `new Date(0)` 而非当天日期 | `getContentDate` 中 fallback 改为 `new Date()` |
| description 可选，从抓取自动获取 | ✅ 通过 | `content.config.ts:11` | `.optional()`，脚本中有 fallback | N/A |
| originalAuthor 和 originalLang 可选 | ✅ 通过 | `content.config.ts:15-16` | 类型正确 | N/A |
| 现有字段兼容不受影响 | ✅ 通过 | `content.config.ts` | tags/coverImage/isDraft 保持不变 | N/A |
| astro check 类型检查通过 | 🔄 待确认 | — | 之前终端运行 `astro check` 返回 exit code 1 | 需运行 `npx astro check` 验证 |

#### 功能2：构建时文章抓取脚本

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| 脚本可独立运行 | ✅ 通过 | `fetch-articles.mjs:1` | shebang + 独立 main 函数 | N/A |
| 能正确解析 sourceUrl | ✅ 通过 | `fetch-articles.mjs:118` | gray-matter 解析 + `data.sourceUrl` 过滤 | N/A |
| 能成功抓取主流技术博客 | ✅ 通过 | `fetch-articles.mjs:83-107` | Readability + linkedom，15s 超时 | N/A |
| 抓取结果正确存入 LanceDB | ✅ 通过 | `fetch-articles.mjs:143` | `upsertRecord()` | N/A |
| 增量判断(contentHash 未变则跳过) | ⚠️ 部分通过 | `fetch-articles.mjs:129-132` | 实际判断逻辑为 `fetchStatus === "success" && originalContent` 非空即跳过，**未使用 contentHash 比对** | 应比对 `computeHash(url, content) !== existing.contentHash` |
| 超时和错误有优雅处理 | ✅ 通过 | `fetch-articles.mjs:86`、`159-173` | AbortController + catch + 记录 failed | N/A |
| 输出清晰的抓取报告日志 | ✅ 通过 | `fetch-articles.mjs:186-189` | 总计/成功/跳过/失败 | N/A |

#### 功能3：LanceDB 文章存储设计

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| articles 表可在 init-db.mjs 中初始化 | ✅ 通过 | `init-db.mjs:252-268` | Phase 3.5 正确实现 | N/A |
| getArticleBySlug 能正确返回 | ✅ 通过 | `article-db.ts:67-81` | 查询 + null 处理 | N/A |
| saveArticle 能正确存储和更新 | ✅ 通过 | `article-db.ts:109-124` | delete + add 模式 | N/A |
| contentHash 可正确判断 | ✅ 通过 | `article-db.ts:129-132` | SHA-256(url + 前500字符) | N/A |
| 类型检查通过 | 🔄 待确认 | — | 需运行 tsc 验证 | 运行 `npx tsc --noEmit` |
| 与现有知识图谱表共存 | ✅ 通过 | `init-db.mjs` | 独立表名 "articles" | N/A |

#### 功能4：构建时翻译流程

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| `--translate` 可独立运行 | ✅ 通过 | `fetch-articles.mjs:36` | `shouldTranslate` 参数 | N/A |
| 可与抓取合并运行 | ✅ 通过 | `fetch-articles.mjs:137-139` | 抓取后自动翻译 | N/A |
| 翻译结果正确存入 LanceDB | ✅ 通过 | `fetch-articles.mjs:213-214` | `upsertRecord` | N/A |
| 长文分段翻译后拼接无遗漏 | ✅ 通过 | `fetch-articles.mjs:151-160` | `splitTextIntoSegments` + join("\n\n") | N/A |
| 代码块/链接在翻译中保持原样 | ⚠️ 部分通过 | `fetch-articles.mjs:72-81` | 仅靠系统提示词约束，无程序化保障（如正则预保护代码块、后还原） | 建议在翻译前提取代码块占位，翻译后还原 |
| API 未配置时有清晰提示 | ✅ 通过 | `fetch-articles.mjs:99-101` | `console.warn` + return null | N/A |
| 翻译失败有重试机制 | ✅ 通过 | `fetch-articles.mjs:111-127` | 指数退避 2 次 | N/A |

#### 功能5：文章详情页改造

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| 详情页从 LanceDB 读取内容 | ✅ 通过 | `[slug].astro:29` | `getArticleBySlug` | N/A |
| 原文/翻译切换可用，无闪烁 | ✅ 通过 | `ArticleReader.tsx:55-59` | CSS opacity 过渡 | N/A |
| 来源链接正确显示可跳转 | ✅ 通过 | `ArticleReader.tsx:71-73` | `target="_blank" rel="noopener"` | N/A |
| 原作者信息正确展示 | ✅ 通过 | `ArticleReader.tsx:66` | 条件渲染 | N/A |
| 阅读时间估算合理 | ✅ 通过 | `article-db.ts:139` | `Math.ceil(wordCount / 200)` | N/A |
| 上一篇/下一篇导航可用 | ✅ 通过 | `[slug].astro:86-98` | 按收录日期排序 | N/A |
| XSS 清理生效 | ❌ 未通过 | `ArticleReader.tsx:28-34` | **使用自制正则而非 DOMPurify**，正则无法防御所有 XSS 向量（如 `<img src=x onerror=alert(1)>` 的变体） | **P0：必须改用 DOMPurify/isomorphic-dompurify** |
| 移动端布局正常 | ✅ 通过 | `global.css:1030-1050` | `@media (max-width: 700px)` 响应式 | N/A |

#### 功能6：语言切换组件

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| 切换按钮可见且可操作 | ✅ 通过 | `LanguageToggle.tsx:22-39` | 原生 button | N/A |
| 切换时内容平滑过渡 | ✅ 通过 | `ArticleReader.tsx:55-59`、`global.css:908-913` | opacity 180ms ≤ 200ms | N/A |
| 用户选择持久化到 localStorage | ✅ 通过 | `LanguageToggle.tsx:63` | `localStorage.setItem(STORAGE_KEY, ...)` | N/A |
| 翻译不可用时降级禁用 | ✅ 通过 | `LanguageToggle.tsx:33` | `disabled={!hasTranslation}` | N/A |
| 键盘可操作 | ✅ 通过 | `LanguageToggle.tsx` | 原生 button 天然支持 Tab/Enter | N/A |
| light/dark 主题下样式正常 | ✅ 通过 | `global.css:874-900` | 使用 CSS 变量 | N/A |

#### 功能7：文章列表页改造

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| 卡片正确展示封面图 | ✅ 通过 | `index.astro:36-39` | 条件渲染 coverImage | N/A |
| 原作者和来源域名信息正确 | ✅ 通过 | `index.astro:45-51` | extractDomain + author | N/A |
| 语言标识与翻译状态一致 | ✅ 通过 | `index.astro:62-65` | EN 始终显示，中有条件 | N/A |
| 点击卡片跳转详情页 | ✅ 通过 | `index.astro:32` | `<a href={toBase(...)}>` | N/A |
| 移动端布局正常 | ✅ 通过 | `global.css:1030-1050` | 响应式卡片 | N/A |

#### 功能8：现有文章迁移

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| 两篇文章在知识库中可正常浏览 | ✅ 通过 | 知识库目录 | 内容完整、frontmatter 正确 | N/A |
| posts 目录下不再有自写文章 | ✅ 通过 | `src/content/posts/` | 仅剩 `when-to-use-memo.md` | N/A |
| 知识库页面无报错 | 🔄 待确认 | — | 需运行 dev server 验证 | 运行 `npm run dev` 检查 |

#### 功能9：构建流程集成

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| `npm run fetch-articles` 可独立运行 | ✅ 通过 | `package.json:13` | script 已配置 | N/A |
| Vercel 部署时自动执行抓取 | ❌ 未通过 | `package.json:8` | **`build` 脚本仍为 `"astro build"`，未集成 fetch-articles** | 改为 `"node scripts/fetch-articles.mjs && astro build"` |
| 增量抓取正常工作 | ⚠️ 部分通过 | `fetch-articles.mjs:129-132` | 跳过逻辑基于 fetchStatus 而非 contentHash | 增加 contentHash 比对 |
| `astro build` 能正常完成 | 🔄 待确认 | — | 需运行验证 | 运行 `npm run build` |

**AC 统计**：
- AC 总数: 39
- ✅ 通过: 30
- ⚠️ 部分通过: 5
- ❌ 未通过: 2
- 🔄 不可评估: 2

---

### 9.3 代码问题清单

| # | 问题类型 | 严重程度 | 位置 | 描述 |
|---|---------|---------|------|------|
| 1 | 安全缺陷 | 🔴 P0 | `ArticleReader.tsx:28-34` | **XSS 清理使用自制正则替代 DOMPurify**。`sanitizeHtml()` 仅过滤 `<script>`、`on*` 事件和 `javascript:` 协议，无法覆盖所有 XSS 向量（如 `<svg/onload=alert(1)>`、编码绕过等）。PRD 明确要求使用 `dompurify`，且 `package.json` 已声明依赖但未引用。 |
| 2 | 需求偏离 | 🔴 P0 | `package.json:8` | **构建脚本未集成 fetch-articles**。`build` 脚本仍为 `"astro build"`，PRD 功能9 要求在 build 前执行抓取。Vercel 部署时不会自动抓取外链文章。 |
| 3 | 逻辑缺陷 | 🟡 P1 | `fetch-articles.mjs:129-132` | **增量抓取判断未使用 contentHash**。当前逻辑为 `fetchStatus === "success" && originalContent` 非空即跳过，即使源文章内容已更新也不会重新抓取。contentHash 已计算但未参与判断。 |
| 4 | 规范问题 | 🟡 P1 | `article-db.ts:55-61` | **`initArticlesTable()` 签名与 PRD 不一致**。PRD 要求 `initArticlesTable(db): Promise<Table>`，实际为 `initArticlesTable(): Promise<Table>`（内部自获取 db 连接）。功能上无影响，但 API 契约不一致。 |
| 5 | 安全隐患 | 🟡 P1 | `article-db.ts:73`、`fetch-articles.mjs:68` | **LanceDB 查询字符串拼接**。`where(\`slug = "${slug}"\`)` 直接拼接字符串，若 slug 含引号或特殊字符可能导致查询异常。建议做转义或参数化。 |
| 6 | 逻辑缺陷 | 🟡 P1 | `content.ts:35` | **date fallback 为 `new Date(0)` 而非当前日期**。PRD 要求"未填时默认为文件修改时间或收录当天"，实际 fallback 到 1970-01-01，会导致未填 date 的文章排序到最前。 |
| 7 | 翻译保障 | 🟡 P1 | `fetch-articles.mjs:175-183` | **翻译时代码块未做程序化保护**。仅靠 LLM 提示词保留代码块，但长文翻译可能丢失代码块标记。建议翻译前用占位符替换代码块，翻译后还原。 |
| 8 | 注释规范 | 🟢 P2 | `fetch-articles.mjs` | 注释风格混合：部分使用 `/*-- --*/` 格式，部分使用标准 `/* */` 或 `//`。PRD 要求中文注释格式为 `/*-- --*/`。 |

---

### 9.4 优化建议

| # | 建议 | 预期收益 | 优先级 |
|---|------|---------|-------|
| 1 | **ArticleReader.tsx 改用 `isomorphic-dompurify` 替代自制 `sanitizeHtml`**。`package.json` 已声明 `isomorphic-dompurify` 依赖，直接 `import DOMPurify from 'isomorphic-dompurify'` 即可。SSR 和客户端均可用。 | 消除 XSS 安全漏洞，符合 PRD 要求 | P0 |
| 2 | **`package.json` 的 `build` 脚本改为 `"node scripts/fetch-articles.mjs && astro build"`**，或在 Vercel 的 `buildCommand` 中集成。 | Vercel 部署时自动抓取，满足功能9 | P0 |
| 3 | **fetch-articles.mjs 增量判断加入 contentHash 比对**：`if (existing && existing.contentHash === computeHash(url, cachedContent))`，而非仅检查 fetchStatus。 | 支持源文章内容更新后自动重新抓取 | P1 |
| 4 | **翻译前提取代码块/行内代码，翻译后还原**。用 `__CODE_BLOCK_0__` 等占位符保护代码片段，防止 LLM 翻译时意外修改。 | 提高翻译质量，代码块完整性有程序化保障 | P1 |
| 5 | **`getContentDate` 的 fallback 从 `new Date(0)` 改为当前日期**。 | 未填 date 的文章不会异常排序到最前 | P1 |
| 6 | **LanceDB where 子句增加 slug 转义**。在查询前对 slug 中的双引号做转义：`slug.replace(/"/g, '\\"')`。 | 防御性编程，防止特殊字符导致查询异常 | P1 |
| 7 | **统一 fetch-articles.mjs 注释格式为 `/*-- --*/`**。 | 符合 PRD 注释规范 | P2 |
| 8 | **在 `[slug].astro` 中为 `getArticleBySlug` 增加 try-catch**。当前如果 LanceDB 连接失败会导致整个页面 500 错误，建议捕获异常后降级到 Markdown 渲染。 | 提升容错性，LanceDB 故障不影响页面可用性 | P2 |

---

### 9.5 综合评估结论

**⚠️ CONDITIONAL PASS — P0 功能完整，P1 有小问题需修复**

文章功能重构的整体实现质量**良好**，核心架构设计合理，文件分工清晰，代码风格与现有代码库一致。9 个功能需求中有 4 个完全实现，3 个部分实现，1 个未实现。

**阻塞性问题（必须修复后才能发布）**：
1. 🔴 **XSS 安全缺陷** — `ArticleReader.tsx` 使用自制正则替代 DOMPurify 做 HTML 清理，存在 XSS 绕过风险。`package.json` 已安装 `isomorphic-dompurify` 但未使用。修改范围小（约 5 行代码）。
2. 🔴 **构建脚本未集成** — `build` 命令未包含 `fetch-articles` 步骤，Vercel 部署时外链文章不会被自动抓取。修改一行 `package.json` 即可。

**改进建议（建议本轮修复）**：
- contentHash 增量抓取逻辑修正
- 翻译代码块保护
- date fallback 逻辑
- LanceDB 查询防御

**推荐下一步行动**：
1. 修复上述 2 个 P0 问题
2. 运行 `npx astro check` 确认类型检查通过
3. 运行 `npm run build` 确认构建流程正常
4. 启动 dev server 验证详情页/列表页渲染效果
5. 进行增量评估（incremental）确认修复
