---
schema: harness-note/1
id: d5d2cc71-8987-47a2-870f-8c3c1e7f7e42
kind: task
lifecycle: proposed
created: 2026-10-05
class: feature
execution: pending
---

# T4 AI 上传处理通道

## Scope

新增 `src/lib/article-intake.service.ts`，把 `scripts/fetch-articles.mjs` 中的 Readability 抓取、语言检测、GLM 全文翻译抽为服务端可导入的模块，并统一 `article-translation.service` 的 `.ts` 与 `.mjs` 双份实现。

新增 `scripts/content-intake.mjs`，接受 `--url`、`--file` 与粘贴正文三种输入，抓取后由 GLM 提取 `title`、`description`、`tags`、`date`、`originalAuthor` 并翻译正文，结果以 `status: draft` 写入 `content` 表。新增 `scripts/content-publish.mjs`，以 `content-schemas` 校验后置为 `status: published` 并触发 Vercel Deploy Hook 重建。dev 面板提供上传文件、粘贴 URL、粘贴正文三个入口与草稿箱、diff 预览与发布按钮。

**草稿口径（Main Agent 裁定，T3 已记录）**：`content` 表记录的 `status` 字段是草稿的权威口径，`content-pull` 只写盘 `status: published` 的记录，所以草稿天然不进构建产物。frontmatter 里的 `isDraft` 是遗留物，由 glob loader 过滤，面板与 intake 一律写 `false`，不得与 `status` 混用。若两者出现冲突，以 `status` 为准。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-6、AC-7。

## Verification

粘贴一个 URL 后 `content` 表出现 `status: draft` 记录，含结构化 frontmatter 与 `originalBody`、`translatedBody`；另一台机器执行 `content-intake --list` 能看到同一批草稿；`content-publish` 后该记录为 `published`，Deploy Hook 被调用，且草稿发布前 `content-pull` 不写盘它（即草稿不进站点）；GLM 失败时草稿保留并标注失败原因，可手工修订后再发布。

## Dependencies

T3（[note://f6f78001-d086-47ba-b627-787ada391296/870946b7-1881-47c6-89ba-6083237cd47a](2026-10-05-task-t3-admin-to-cloud--870946b7.md)）已落地，管理写入走 `content-store`。

## Allowed scope

`src/lib/article-intake.service.ts`、`src/lib/article-translation.service.ts`、`src/lib/article-translation.service.mjs`、`scripts/content-intake.mjs`、`scripts/content-publish.mjs`、`src/pages/api/admin/intake.ts`、`src/pages/admin/posts.astro`
