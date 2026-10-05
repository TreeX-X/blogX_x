---
schema: harness-note/1
id: d9b0811d-35ac-47dd-a009-5e15e29bbda5
kind: task
lifecycle: proposed
created: 2026-10-05
class: bug-fix
execution: pending
---

# T6 修复「相关阅读」恒为空

## Scope

`src/lib/article-db.ts` 的 `getRelatedContent` 修复同根因的双引号查询 bug。该函数对 `blog_index` 表执行 `.where(\`slug = "${escapeSlug(slug)}"\`)`（`:395`）与 fallback 的 `.where(\`url = "/posts/${escapeSlug(slug)}"\`)`（`:402`），双引号被 LanceDB 的 DataFusion 当标识符解析，查询报 400（实测 `Schema error: No field named "anthropic-harness-design-long-running-apps". Valid fields are id, collection, slug, title, content, url, vector.`），外层 catch 吞掉后静默返回 []，故「相关阅读」区块长期恒空。

修法二选一，按实际验证结果定：改为单引号字面量转义（与 `content-store` 的 `sqlLiteral` 同范式），或改为全表 scan 后 JS 匹配。不得保留双引号拼接。返回的 `RelatedContent[]` 字段与数量上限不变，`src/pages/posts/[slug].astro` 的调用方零改动。

**同一文件内已确认的第三处**：`src/lib/article-db.ts:294` 的 `.where(\`fetchStatus = "${status}"\`)`（`getArticlesByStatus` 内）是同一写法、同一机制，同样 400 后返 []。T2 评审读码时新发现， Main Agent 已复核行号与上下文。本任务须一并修掉，不允许只修前两处留下同族 bug。

## Acceptance

- [ ] AC-1: `getRelatedContent` 对三篇现存 posts 各自返回非空结果（或在该篇确无近邻时返回空且日志可判因）。
- [ ] AC-2: `getArticlesByStatus` 对合法 status 能返回对应记录，不再恒返 []。
- [ ] AC-3: `src/lib/article-db.ts` 内不再存在任何双引号拼接的 `where` 谓词。
- [ ] AC-4: 生产构建产物与构建日志中不再出现该查询的 400 报错。
- [ ] AC-5: `src/pages/posts/[slug].astro` 未被改动，「相关阅读」区块标题、条数与跳转目标行为正确。
- [ ] AC-6: 未新增 `astro check` 报错。

## Verification

`npx astro build` 通过且构建日志无相关 400；对三篇 slug 分别调用 `getRelatedContent` 并打印返回条数与首条标题；对每种合法 status 调用 `getArticlesByStatus` 并打印条数；`grep -n 'where(\`' src/lib/article-db.ts` 确认无双引号写法残留；未登录与登录态下详情页「相关阅读」渲染正常。

## Dependencies

T1（[note://f6f78001-d086-47ba-b627-787ada391296/a7c1fab4-4118-443f-8de0-60c44714b875](2026-10-05-task-t1-content-store--a7c1fab4.md)）已落地。本任务与 T2–T5 无文件交集，可独立排期，不必等 T5。

## Allowed scope

`src/lib/article-db.ts`
