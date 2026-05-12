# Session: 文章功能重构

## PRD 路径
- `docs/article-refactor-prd.md`

## 实施顺序（按优先级）
- [x] P0: Frontmatter Schema 扩展 (`content.config.ts`) ✅
- [x] P0: LanceDB 文章存储工具 (`src/lib/article-db.ts`) ✅
- [x] P0: 构建时抓取脚本 (`scripts/fetch-articles.mjs`) ✅ 已验证抓取成功
- [x] P0: 构建时翻译流程（同一脚本，--translate 标志）✅ 代码完成，需 OPENAI_API_KEY 运行时验证
- [x] P0: 文章详情页改造 (`[slug].astro`) ✅
- [x] P0: 语言切换组件 (`LanguageToggle.tsx` + `ArticleReader.tsx`) ✅ 已用 DOMPurify
- [x] P1: 文章列表页改造 (`index.astro`) ✅
- [x] P1: 现有文章迁移（2篇 → 知识库）✅
- [x] P1: 构建流程集成 ✅ build 脚本已集成 fetch-articles

## 关键决策
- LanceDB 复用现有实例，新增 articles 表
- 翻译用 OpenAI 兼容 API
- 抓取用 @mozilla/readability + linkedom
- XSS 清理用 isomorphic-dompurify
- tsconfig.json 修复了 baseUrl 缺失问题

## 验证结果
- TypeScript: 0 个新错误（10 个预先存在）
- 抓取脚本: 成功抓取 kentcdodds.com 文章（2420 词）
- LanceDB: 数据正确存储
- 翻译: 需配置 OPENAI_API_KEY 后使用 `npm run fetch-articles:translate`

## 遗留事项
- 配置 OPENAI_API_KEY 后运行翻译测试
- 删除 `src/content/posts/` 下旧文章（已完成迁移）
