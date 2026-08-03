# 📘 PRD - 内容采集与阅读体验优化

> **合并自**：`article-refactor-prd.md`（v1.0, 2026-05-12）+ `layout-kb-optimization-prd.md`（v1.0, 2026-05-11）
> **文档状态**: 已实现（细节见第 9 节「实现现状」）
> **更新日期**: 2026-07-29
> **版本**: v2.0

本 PRD 覆盖 BlogX_x 内容侧的两条主线：
- **Part A — 文章外链采集与全文翻译**：把「文章」从自写正文转型为外链收藏 + 构建时自动抓取 + 中英文全文翻译。
- **Part B — 布局与知识库阅读体验**：放宽容器宽度、为知识库列表页增加分类侧栏、打磨 Markdown 排版。

两条主线共享同一套阅读体验目标，且改动集中在 `src/styles/global.css`、文章/知识库页面与内容层，故合并维护。

---

# Part A — 文章外链采集与全文翻译

## A1. 🎯 项目概述

- **项目目标**：将 BlogX_x 的「文章」功能从「自写文章展示」转型为「外链优秀文章收藏 + 构建时自动抓取 + 中英文全文翻译」。博主在本地 Markdown 中记录文章链接与元数据，构建流程自动抓取原文并翻译，最终呈现带中英切换的沉浸式阅读体验。
- **核心价值**：让博主成为优质内容的策展人——不需要自己写长文，通过收藏和翻译优秀外文技术文章来输出价值，同时保留原作者归属和来源链接。

### A1.1 转型前后对比

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| 内容来源 | 博主自己撰写 Markdown 正文 | 博主粘贴外链 URL，正文自动抓取 |
| 正文存储 | 直接在 `.md` 文件中 | LanceDB 中（原文 + 翻译） |
| 翻译 | 无 | 构建时 LLM 全文中英翻译，前端切换 |
| Frontmatter | title/date/description 必填 | sourceUrl 必填，title/date/description 可选（可自动提取） |
| 现有自写文章 | 2 篇 | 迁移至知识库后清除 |

## A2. 🚧 边界与范围

### 在范围内

- 扩展 posts 内容集合的 frontmatter schema（新增 `sourceUrl`、`originalAuthor`、`originalLang` 等字段）
- 构建时文章抓取脚本 `scripts/fetch-articles.mjs`（抓取正文、提取元数据、存入 LanceDB）
- 构建时翻译流程（调用 LLM API 全文翻译、存入 LanceDB）
- LanceDB 文章存储表设计与读写工具函数
- 改造文章列表页（`src/pages/posts/index.astro`）—— 展示来源、语言标识、封面
- 改造文章详情页（`src/pages/posts/[slug].astro`）—— 原文/翻译切换、来源回链
- React 组件 `ArticleReader.tsx`（翻译切换按钮 + 内容渲染）
- React 组件 `LanguageToggle.tsx`（中英文切换 UI）
- `src/lib/content.ts` 增加 LanceDB 文章读取函数
- 构建流程集成（`package.json` `build` 中增加 fetch-articles 步骤）
- 迁移现有 2 篇自写文章到知识库

### 在范围外 / 非目标

- 不改变知识库功能（knowledgeBase 集合不受影响）
- 不构建管理后台 UI（文章通过本地 Markdown 管理；后台 posts 管理面由后续管理套件提供）
- 不做客户端实时抓取（全部在构建时完成）
- 不做段落级翻译缓存（全文翻译一次性存入 LanceDB）
- 不改变整体视觉风格（暖纸 + 牛血红编辑器美学）
- 不修改导航栏结构

## A3. 🛡️ 非功能性需求

- **注释**：生成代码需添加中文注释，格式为 `/*-- 注释内容 --*/`
- **响应式**：文章详情页在所有视口下无横向溢出
- **性能**：翻译内容预生成，运行时无 LLM API 调用；LanceDB 读取延迟 < 100ms
- **可访问性**：翻译切换按钮需具备 `aria-label`，键盘可操作
- **主题兼容**：所有新增样式必须兼容暖纸 + 牛血红主题（light-only）
- **错误处理**：抓取失败时优雅降级（显示摘要 + 原文链接，标记「抓取失败」）
- **构建约束**：Vercel Serverless 环境下，构建脚本需在 `astro build` 之前执行

## A4. 📈 成功标准

| 指标 | 目标 |
|------|------|
| 博主收录一篇新文章的时间 | < 1 分钟（只需填写 URL + 可选元数据） |
| 构建时抓取成功率 | ≥ 90%（对主流技术博客站点） |
| 翻译质量 | 可读性良好，技术术语准确（由 LLM 质量保证） |
| 详情页加载速度 | 与重构前无明显差异（LanceDB 读取 < 100ms） |
| 中英文切换延迟 | < 50ms（纯前端切换，无网络请求） |

## A5. ⚙️ 核心功能与验收标准

### 功能 A1：Frontmatter Schema 扩展（P0）

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

正文区域不再需要手动编写，留空即可；抓取到的原文和翻译存储在 LanceDB 中。

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

### 功能 A2：构建时文章抓取脚本（P0）

**描述**：`scripts/fetch-articles.mjs` 在构建时扫描所有 posts，对带 `sourceUrl` 的文章自动抓取原文。

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
- HTTP 请求：Node.js 内置 `fetch`（Node 22+）
- HTML 解析：`linkedom`（轻量、无原生依赖、Vercel 兼容）
- 正文提取：`@mozilla/readability`（Mozilla Reader View 同款算法）
- Frontmatter 解析：`gray-matter`

**错误处理**：
- 抓取超时（15s）→ 跳过，记录日志
- HTTP 错误 → 跳过，记录日志
- 解析失败 → 存入仅包含 URL 的最小记录，标记 `fetchStatus: 'failed'`

**验收标准**：
- [ ] 脚本可通过 `node scripts/fetch-articles.mjs` 独立运行
- [ ] 能正确解析 frontmatter 中的 `sourceUrl`
- [ ] 能成功抓取并提取主流技术博客（Medium、Dev.to、个人博客）的正文
- [ ] 抓取结果正确存入 LanceDB
- [ ] 重复抓取有增量判断（contentHash 未变则跳过）
- [ ] 超时和错误有优雅处理，不中断构建流程
- [ ] 输出清晰的抓取报告日志

### 功能 A3：LanceDB 文章存储设计（P0）

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

**工具函数**（`src/lib/article-db.ts`）：
- `getArticleBySlug(slug): Promise<ArticleRecord | null>` — 按 slug 查询
- `saveArticle(record: ArticleRecord): Promise<void>` — 存储/更新文章
- `getArticlesByStatus(status: string): Promise<ArticleRecord[]>` — 按状态查询（脚本用）
- `initArticlesTable(): Promise<Table>` — 初始化表（幂等）

> 注：实际实现中 `initArticlesTable()` 不接收 `db` 参数，内部自获取连接；与上表的契约存在轻微偏离，但功能无影响。

**验收标准**：
- [ ] LanceDB articles 表可在 `init-db.mjs` 中初始化
- [ ] `getArticleBySlug` 能正确返回文章记录
- [ ] `saveArticle` 能正确存储和更新
- [ ] contentHash 机制可正确判断是否需要重新抓取
- [ ] `src/lib/article-db.ts` 类型检查通过
- [ ] 与现有向量索引表共存，互不影响

### 功能 A4：构建时翻译流程（P0）

**描述**：抓取完成后，对原文内容调用 LLM API 进行全文中文翻译，翻译结果存入 LanceDB。翻译服务见 `src/lib/article-translation.service.*`。

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
- 模型默认 `gpt-4o-mini`（可经 `TRANSLATE_MODEL` 覆盖）
- 长文分段翻译（每段 ≤ 4000 tokens），保持段落边界

**翻译提示词**：
```
你是一位专业的技术文章翻译者。请将以下英文技术文章翻译为中文。
规则：
1. 保留所有代码块（```...```）原样不翻译
2. 保留所有行内代码（`...`原样不翻译
3. 保留所有链接 URL 不翻译，但翻译链接文字
4. 保留所有图片 URL 不翻译
5. 技术术语首次出现时用「中文（English）」格式，后续直接用中文
6. 保持原文的段落结构和 Markdown 格式
7. 翻译要自然流畅，不要生硬直译
```

**错误处理**：
- API 调用失败 → 重试 2 次（指数退避）
- 仍失败 → 标记 `translatedContent: ''`，前端降级显示原文
- API Key 未配置 → 跳过翻译，前端提示「翻译未配置」

**验收标准**：
- [ ] 翻译可通过 `node scripts/fetch-articles.mjs --translate` 运行
- [ ] 也可与抓取合并运行 `node scripts/fetch-articles.mjs`
- [ ] 翻译结果正确存入 LanceDB
- [ ] 长文分段翻译后拼接无遗漏
- [ ] 代码块/链接在翻译中保持原样
- [ ] API 未配置时有清晰提示，不中断构建
- [ ] 翻译失败有重试机制

### 功能 A5：文章详情页改造（P0）

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
- 内容渲染时使用 **`isomorphic-dompurify`** 做 XSS 清理
- 显示原作者、来源域名、收录日期、预估阅读时间（`Math.ceil(wordCount / 200)`）
- 新增上一篇/下一篇导航（按收录日期排序）
- 来源回链在页面底部，明确标注「查看原文」

**验收标准**：
- [ ] 详情页从 LanceDB 读取文章内容
- [ ] 原文/翻译切换按钮可用，切换无闪烁
- [ ] 来源链接正确显示并可点击跳转
- [ ] 原作者信息正确展示
- [ ] 阅读时间估算合理
- [ ] 上一篇/下一篇导航可用
- [ ] XSS 清理生效（使用 DOMPurify，恶意脚本不执行）
- [ ] 移动端布局正常

### 功能 A6：语言切换组件（P0）

**描述**：React 组件 `LanguageToggle.tsx` 提供中英文切换 UI。

**设计要求**：
- 两个按钮并排：`English` / `中文`
- 当前激活语言有视觉高亮
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
- [ ] 暖纸 + 牛血红主题下样式正常

### 功能 A7：文章列表页改造（P1）

**描述**：改造 `src/pages/posts/index.astro`，适配外链文章的展示需求。

**卡片设计**：
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
- 显示封面图（优先 frontmatter `coverImage`，其次从 LanceDB 读取 og:image）
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

### 功能 A8：现有文章迁移（P1）

**描述**：将现有 2 篇自写文章迁移到知识库，并从 posts 中清除。

| 原文件 | 目标 |
|--------|------|
| `src/content/posts/get-started-with-astro.md` | `src/content/knowledge-base/开发经验/Astro博客搭建指南.md` |
| `src/content/posts/black-white-typography.md` | `src/content/knowledge-base/开发经验/黑白主题排版.md` |

**验收标准**：
- [ ] 两篇文章在知识库中可正常浏览
- [ ] posts 目录下不再有自写文章
- [ ] 知识库列表页和详情页无报错

### 功能 A9：构建流程集成（P1）

**描述**：将抓取和翻译脚本集成到项目构建流程中。

**实现要求**：
- `package.json` scripts：`fetch-articles`、`fetch-articles:translate`
- `build` 命令在 `astro build` 之前依次执行 `init-db` → `fetch-articles --translate`
- 本地开发时可选运行（避免每次 dev 都抓取）
- 增量抓取：仅对新文章或内容变化的文章重新抓取（基于 contentHash）

**验收标准**：
- [ ] `npm run fetch-articles` 可独立运行
- [ ] Vercel 部署时自动执行抓取与翻译
- [ ] 增量抓取正常工作（contentHash 未变则跳过）
- [ ] `astro build` 能正常完成

---

# Part B — 布局与知识库阅读体验

## B1. 🎯 项目概述

- **项目目标**：优化 BlogX_x 在 PC 端与移动端的布局体验，扩展内容区域有效利用面积，为知识库列表页增加分类侧栏，并改善 Markdown 内容的排版呈现质量。
- **核心价值**：在不破坏现有暖纸 + 牛血红编辑器风格的前提下，让 PC 端用户充分利用屏幕宽度，让移动端用户继续获得良好体验，同时提升知识库的可浏览性和导航效率。

## B2. 🚧 边界与范围

### 在范围内

- `.container` 宽度策略重构，PC 端放宽上限，移动端保持当前适配
- 文章详情页与知识库详情页的网格列宽优化
- `.prose-wrap` 的 `max-width` 调整
- 知识库列表页新增分类侧栏组件
- Markdown 渲染样式的补充优化
- 所有改动仅通过 CSS 和 Astro 模板层面实现

### 在范围外 / 非目标

- 不改变整体视觉风格（暖纸 + 牛血红、编辑器美学）
- 不修改数据层（`lib/content.ts`、内容集合配置）
- 不添加新的 API 端点
- 不重构首页布局（`home-layout` 已充分利用空间）
- 不引入外部 CSS 框架或 UI 组件库
- 不重新设计导航栏和 footer

## B3. 🛡️ 非功能性需求

- **注释**：生成代码需添加中文注释，格式为 `/*-- 注释内容 --*/`
- **响应式**：所有布局改动通过 `@media` 查询适配多分辨率屏幕（断点沿用 `700px`）
- **性能**：不引入额外 JS 运行时开销
- **可访问性**：侧栏导航需具备 `aria-label`，键盘可聚焦
- **主题兼容**：所有新增样式必须兼容暖纸 + 牛血红主题（light-only）
- **多分辨率适配**：覆盖移动端（375/414）、平板（768/1024）、笔记本（1280/1366）、桌面（1440/1920/2560）；使用流式布局（`minmax`、`clamp`、`min/max`）；关键断点 `≤700px` / `701–1024px` / `≥1025px`

## B4. 📈 成功标准

- PC 端（≥1280px）内容区有效宽度利用率从约 55% 提升至 ≥75%
- 知识库列表页侧栏在 PC 端可见且可交互，在移动端合理隐藏或折叠
- Markdown 内容在长段落、代码块、表格、图片等场景下排版美观无溢出

## B5. ⚙️ 核心功能与验收标准

### 功能 B1：容器宽度策略重构（P0）

**描述**：`.container` 由 `width: min(840px, calc(100% - 2rem))` 提升至 `min(1200px, ...)`，PC 端充分利用屏幕空间，移动端保持不变。

**验收标准**：
- [ ] PC 端（≥1280px 视口）容器宽度 > 1000px
- [ ] 移动端（≤700px 视口）容器宽度行为与改动前完全一致
- [ ] 导航栏在所有视口下对齐无异常
- [ ] footer 在所有视口下对齐无异常

### 功能 B2：文章 / 知识库详情页布局优化（P0）

**描述**：扩大 `.article-layout` 正文可用宽度，`.prose-wrap` `max-width` 由 `72ch` 提升至 `82ch`，右侧 TOC 列宽增至 `260px`，移动端折叠为单列。

**验收标准**：
- [ ] PC 端文章正文区域有效宽度 ≥ 700px（在 1280px 视口下）
- [ ] TOC 侧栏在 PC 端 sticky 定位正常
- [ ] 移动端为单列布局，无横向溢出

### 功能 B3：知识库列表页侧栏（P0）

**描述**：新增 `.kb-layout` grid 双栏布局与分类侧栏，支持锚点平滑滚动；移动端改为横向分类标签条。

**实现要求**：
- `.kb-layout` grid：`grid-template-columns: minmax(0, 1fr) 240px`
- 侧栏：分类列表锚点链接，点击平滑滚动
- `.sticky` 固定在视口顶部（复用 `top: 84px`）
- 复用 `.kg-panel` 边框和背景风格
- 每条目显示分类名称和条目数量
- 移动端隐藏侧栏，改为横向分类标签条
- 各分类区块添加 `id` 支持锚点跳转

**验收标准**：
- [ ] PC 端知识库列表页右侧出现分类侧栏
- [ ] 侧栏 sticky 定位正常
- [ ] 点击分类条目，页面平滑滚动到对应区域
- [ ] 侧栏显示每个分类的条目数量
- [ ] 移动端侧栏不显示，改为横向分类标签条
- [ ] 侧栏样式与现有卡片/面板风格一致

### 功能 B4：Markdown 内容显示优化（P1）

**实现要求**：
- **代码块**：暗色主题下增强背景对比度，添加左侧边线
- **表格**：外层包裹 `overflow-x: auto`
- **引用块**：更明显的左侧色彩标识
- **链接**：正文链接添加下划线或颜色区分
- **图片**：`max-width: 100%; height: auto`
- **hr**：`border: none; border-top: 1px solid var(--line)`
- **嵌套列表**：合理的左缩进
- **知识库特殊处理**：`.kb-prose` 保留 `white-space: pre-wrap`

**验收标准**：
- [ ] 代码块可读性良好
- [ ] 移动端表格可水平滚动，不导致页面横向溢出
- [ ] 引用块视觉上明显区分于正文
- [ ] 正文链接与普通文字有明确视觉差异
- [ ] 图片在所有视口下不溢出
- [ ] `hr` 元素渲染为水平分割线
- [ ] 嵌套列表缩进合理

### 功能 B5：文章列表页适配（P2）

**验收标准**：
- [ ] 文章列表在宽屏下卡片文字行宽不超过 100 字符
- [ ] 移动端列表布局不变

### 功能 B6：关于页 / 工具箱页适配（P2）

**验收标准**：
- [ ] 关于页文字行宽合理
- [ ] 工具箱卡片网格在宽屏下多列对齐美观
- [ ] 移动端布局不受影响

## B6. 📚 工程文件索引（Part B）

| 文件路径 | 文件作用 |
|---------|---------|
| `src/styles/global.css` | 全局样式：容器宽度、侧栏、Markdown 优化均在此 |
| `src/layouts/BaseLayout.astro` | 基础布局，容器宽度影响所有页面 |
| `src/pages/knowledge-base/index.astro` | 知识库列表页（功能 B3 主改动） |
| `src/pages/posts/[slug].astro` | 文章详情页（功能 B2） |
| `src/pages/knowledge-base/[...slug].astro` | 知识库详情页（功能 B2/B4） |
| `src/pages/posts/index.astro` | 文章列表页（功能 B5） |
| `src/pages/index.astro` | 首页（确认容器变化后表现） |
| `src/pages/about.astro` | 关于页（功能 B6） |
| `src/pages/toolbox/index.astro` | 工具箱页（功能 B6） |

---

# 9. 📌 实现现状（基于当前工程代码，2026-07-29）

> 本节取代历史 point-in-time 评估报告，反映当前代码真实状态。工程真相以 `wiki/` 与源码为准。

## 9.1 Part A — 文章外链采集与翻译：已实现

| 功能 | 状态 | 对应代码 | 说明 |
|------|------|---------|------|
| A1 Schema 扩展 | ✅ | `src/content.config.ts` | `sourceUrl` 必填 + URL 校验，其余可选，`originalLang` 默认 `en` |
| A2 抓取脚本 | ✅ | `scripts/fetch-articles.mjs` | Readability + linkedom，15s 超时，输出抓取报告 |
| A3 LanceDB 存储 | ✅ | `src/lib/article-db.ts`、`scripts/init-db.mjs` | `articles` 表独立于向量索引表 |
| A4 翻译流程 | ✅ | `scripts/fetch-articles.mjs`、`src/lib/article-translation.service.*` | 分段翻译 + 指数退避重试 |
| A5 详情页改造 | ✅ | `src/pages/posts/[slug].astro`、`src/components/ArticleReader.tsx` | 原文/翻译切换、来源回链、阅读时间 |
| A6 语言切换组件 | ✅ | `src/components/LanguageToggle.tsx` | 持久化、降级、aria 属性 |
| A7 列表页改造 | ✅ | `src/pages/posts/index.astro` | 封面、来源、语言标识 |
| A8 文章迁移 | ✅ | 知识库目录 | 自写文章已迁出 posts |
| A9 构建流程集成 | ✅ | `package.json` | `build` = `init-db` → `fetch-articles --translate` → `astro build` |

### 历史评估中 flagged 问题的当前状态

| 历史问题 | 历史等级 | 当前状态 | 依据 |
|---------|---------|---------|------|
| XSS 清理使用自制正则 | 🔴 P0 | ✅ 已修复 | `ArticleReader.tsx` 改用 `isomorphic-dompurify`（`DOMPurify.sanitize`） |
| 构建脚本未集成 fetch-articles | 🔴 P0 | ✅ 已修复 | `build` 已串联 `init-db && fetch-articles --translate && astro build` |
| 增量抓取未用 contentHash | 🟡 P1 | ✅ 已修复 | `fetch-articles.mjs` 通过 `existing.contentHash !== newContent.contentHash` 判断是否重抓 |
| date fallback 为 `new Date(0)` | 🟡 P1 | ✅ 已修复 | `content.ts` `getContentDate` 改为 `tryParseDateFromId(id) \|\| new Date()` |
| LanceDB where 子句拼接 | 🟡 P1 | ✅ 已修复 | `article-db.ts` 使用 `safeSlug` 转义 |
| 翻译代码块程序化保护 | 🟡 P1 | ⚠️ 仍靠提示词 | 翻译前未做代码块占位替换，依赖 LLM 提示词约束；长文偶有丢失风险 |
| `initArticlesTable()` 签名 | 🟡 P1 | ⚠️ 契约轻微偏离 | 实际不接收 `db` 参数，内部自获取连接；功能无影响 |

## 9.2 Part B — 布局与知识库：已实现

| 功能 | 状态 | 对应代码 | 说明 |
|------|------|---------|------|
| B1 容器宽度 | ✅ | `global.css` | `.container` 从 `min(840px, ...)` 改为 `min(1200px, ...)`，移动端行为不变 |
| B2 详情页布局 | ✅ | `global.css` | `prose-wrap` 72ch→82ch，`article-layout` 右列 230px→260px，移动端单列 |
| B3 知识库侧栏 | ✅ | `global.css`、`kb/index.astro` | `.kb-layout` 双栏 + 分类侧栏 + 移动端标签条 |
| B4 Markdown 优化 | ✅ | `global.css` | 代码块/表格/引用/链接/图片/hr/嵌套列表全部优化 |
| B5 文章列表适配 | ✅ | `posts/index.astro` | 内联 `max-width: 780px` 控制卡片行宽 |
| B6 关于/工具箱适配 | ✅ | `about.astro`、`global.css` | 关于页 780px 限宽，工具箱 `repeat(auto-fit, ...)` |

### 已知低优先级遗留

- `global.css` 中 `.prose-wrap pre` 与 `.prose-wrap img` 存在重复定义（功能正确，可合并以提升可维护性）。
- 移动端 `.kb-tag-item` 缺少 `:active` 视觉反馈。
- 主题描述已统一为「暖纸 + 牛血红」（历史 PRD 中的「极简黑白」表述已废弃）。

## 9.3 综合结论

Part A 与 Part B 均已完整落地。Part A 历史 P0 阻塞问题（XSS、构建集成）均已修复，P1 防御性问题大部分已修复；Part B 全部 6 项功能与验收标准通过。后续迭代可关注：翻译代码块占位保护、CSS 重复规则合并、移动端标签触摸反馈。