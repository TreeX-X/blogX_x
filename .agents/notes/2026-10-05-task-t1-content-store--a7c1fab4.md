---
schema: harness-note/1
id: a7c1fab4-4118-443f-8de0-60c44714b875
kind: task
lifecycle: implemented
created: 2026-10-05
class: architecture
execution: completed
---

# T1 内容存储层与一次性迁移

## Scope

新增 `src/lib/content-schemas.ts`，从 `src/content.config.ts` 抽出 zod 定义共用，`content.config.ts` 改为 import 它，集合定义与校验永不漂移。新增 `src/lib/content-store.ts`，提供 `listCollection`、`getEntry`、`upsertEntry`、`deleteEntry`、`setStatus`，读写 LanceDB `content` 表（字段 `collection`、`path`、`frontmatter`、`body`、`originalBody`、`translatedBody`、`status`、`updatedAt`）。

新增 `scripts/content-migrate.mjs`，把 `src/content/**` 的全部内容灌入 `content` 表：posts 3 条、knowledgeBase **15** 条、wiki 29 条、repos 5 条、skills 5 条、projects 2 条，共 59 条，保留 KB 与 wiki 的嵌套路径。把 `articles` 表三篇的真双语代合并进对应 posts 记录的 `originalBody`、`translatedBody`；`src/lib/article-db.ts` 的 `getArticleBySlug` 改查 `content` 表，四个对外函数签名与返回字段不变（`src/pages/posts/index.astro` 与 `src/pages/posts/[slug].astro` 零改动），`articles` 表保留为迁移期只读回退，验证后废弃。

**禁止迁移 `src/content/knowledge-base/思路记载/未命名.md`**。该文件是用户 vault 中的私人笔记，从未发布，已由 `.git/info/exclude` 在本地排除。迁移脚本以固定排除清单跳过它；今后任何"从 vault 导入"的路径都必须按条目登记，禁止整库自动同步。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-3。

## Verification

2026-10-05 由 coderX 实施、evaluatorX 独立评审（PASS），关键实测：

- `content` 表 59 行 = posts 3 / knowledgeBase 15 / wiki 29 / repos 5 / skills 5 / projects 2；`status` 全 published；`(collection, path)` 无重复；行字段恰为约定的 8 个。先删后插使脚本幂等，重复执行不产生重复行。
- 私人笔记未入表：`collection=knowledgeBase` 下无 `思路记载/未命名`，dry-run 报告跳过 1 条。**注意存在同名但合法的已发布页** `wiki/sources/未命名`（body 167 字节、frontmatter `{}`，与源文件一致），它应在表中，不得误判为泄露。
- 双语合并保真：content 行与 `articles` 表选取行逐字段全等（`originalBody`/`translatedBody`、title、description、author、coverImage、wordCount、contentHash、fetchStatus、fetchedAt、translatedAt、sourceUrl、originalLang）。三篇为 en→zh、zh→en、en→zh 的真双语代。
- **代际选取经独立复核**：`articles` 表实为 15 行（每 slug 5 行、3 代）。评审方用 `src/lib/article-translation.service.mjs` 的 `detectLanguage` 跑遍 15 行，确认三篇 2026-06 代译文语言与原文相反，而 2026-10-05 两代译文与原文同语言（失败代），选取规则"译文语言与原文相反 + translatedAt 最新"正确。
- `content-store` 隔离探针 24 项通过：异形 path 往返（中文、全角冒号、圆括号、空格、单引号、反斜杠、emoji）、重复 upsert 恒 1 行且后者生效、注入串按字面量处理不删行不复制、`getEntry` 缺失返 null、`setStatus` 缺失抛错、`setStatus` 只改 status 不动 body、`deleteEntry` 幂等、按集合隔离。cloud 转义验证 12 条谓词全命中或正确归零，读取路径不存在拼接 `where` 的代码。
- schema 无漂移：程序化比对 HEAD 与现树，六个集合 zod 定义逐字段等价（含 optional/default），glob loader 的 pattern/base 与 `collections` 键全等。
- `npx astro check`：10 errors / 93 hints，与 HEAD 基线完全一致，未新增；`content-schemas.ts` 仅有 zod 弃用提示（系原 `content.config.ts` 内联 schema 同批警告随文件迁移）。
- 双语渲染首次真正生效的证据：`dist/client/posts/anthropic-…/index.html` 136 KB，含 `article-source-bar`（作者 Prithvi Rajasekaran、来源 anthropic.com、约 25 分钟）、`lang-toggle`（中默认激活、EN 可切）、SSR 渲染的中文译文；HEAD 基线同页 28 KB、无 article-reader、走 Markdown Content。
- 范围纪律：仅 Allowed Scope 内 5 个文件。

### 证据的边界

`articles` 表 15 行中含两代失败译文，故"6 月代即站点此前实际呈现内容"这一判断依赖另一个事实：旧读法恒返回 null（见下），页面此前走 Markdown 降级，从未渲染 articles 表内容。因此本次迁移**改变了文章详情页的实际行为**——从 Markdown 单语降级变为设计原本意图的双语渲染。这是修复，但是一次可见的行为变化。

## Known items

- **构建曾因私人笔记而红（已处置，未根除）**。被钩子同步进工作树的 `src/content/knowledge-base/思路记载/未命名.md` 第 30 行引用本地不存在的 `Pasted%20image%2020260918134859.png`，而 `src/pages/knowledge-base/[...slug].astro` 对 glob 到的全部条目 `render()`，Astro 抛 `ImageNotFound` 使整个构建失败。评审方以 `git archive HEAD` 重建基线复现同一点失败，确认非本任务回归。已删除工作树副本使构建恢复通过。**该文件会被 pre-commit 钩子重新同步回来**，每次提交后都可能复现，根除依赖 T2 内容出仓或 T5 改造同步脚本；在此期间构建异常先查此处。
- **`article-db.getRelatedContent` 仍是同一处双引号 bug 类**。`src/lib/article-db.ts:395`、`:402` 的 `where(\`slug = "${escapeSlug(slug)}"\`)` 与 `where(\`url = "/posts/${escapeSlug(slug)}"\`)` 在构建日志实测 400 → catch 后静默返回 [] → 「相关阅读」区块长期恒空。HEAD 即有（`2cf16d4` 引入）。已立独立任务 [修复相关阅读空列表](2026-10-05-task-t6-fix-related-content--d0a6d506.md)，待 Main Agent 排期。
- **写入管线侧尚未收口**。`scripts/fetch-articles.mjs` 仍直写 `articles` 表并改写 `src/content/posts/*.md`。AC-3 的「无第二份正文 master」在站点读取侧成立，在写入管线侧要等 T5 收口。
- **`/posts` 卡片描述来源变化**。因读取路径恢复，描述改为 `article?.description || post.data.description`：anthropic 篇现为 Anthropic 站点通用英文简介（articles 表数据如此），另两篇为真实摘要；封面、作者、阅读时长、双语徽章随之出现。均为页面既有逻辑加保真映射所致，非映射错误。
- **写入竞争窗口**。`upsertEntry` 与迁移脚本的先删后插在"删除请求网络失败、随后插入成功"的窄窗口会产生重复行。59 条规模与 CLI 单写者场景下未复现；若重现，改用 `mergeInsert(['collection','path'])` 根治。

## Dependencies

T0（[note://f6f78001-d086-47ba-b627-787ada391296/a53dfd24-4a0a-4571-a964-93396c10d981](2026-10-05-task-t0-revoke-public-write--a53dfd24.md)）已落地并提交。本任务与 T0 改动零文件交集。

## Allowed scope

`src/lib/content-schemas.ts`、`src/lib/content-store.ts`、`src/lib/article-db.ts`、`src/content.config.ts`、`scripts/content-migrate.mjs`
