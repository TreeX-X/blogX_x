---
schema: harness-note/1
id: a7c1fab4-4118-443f-8de0-60c44714b875
kind: task
lifecycle: proposed
created: 2026-10-05
class: architecture
execution: pending
---

# T1 内容存储层与一次性迁移

## Scope

新增 `src/lib/content-schemas.ts`，从 `src/content.config.ts` 抽出 zod 定义共用，`content.config.ts` 改为 import 它，集合定义与校验永不漂移。新增 `src/lib/content-store.ts`，提供 `listCollection`、`getEntry`、`upsertEntry`、`deleteEntry`、`setStatus`，读写 LanceDB `content` 表（字段 `collection`、`path`、`frontmatter`、`body`、`originalBody`、`translatedBody`、`status`、`updatedAt`）。

新增 `scripts/content-migrate.mjs`，把现有 `src/content/**` 全部 55 条灌入 `content` 表，保留 KB 与 wiki 的嵌套路径；把 `articles` 表三篇的 `originalContent` 与 `translatedContent` 合并进对应 posts 记录的 `originalBody`、`translatedBody`；`src/lib/article-db.ts` 改查 `content` 表，`getArticleBySlug` 签名与调用方不变，`articles` 表保留为迁移期只读回退，验证后废弃。

`src/content/**` 在本任务内仍留在 git 中，仓库同时是迁移目标与迁移期的完整备份。内容出仓见 [内容出仓决策](2026-10-05-decision-content-out-of-repo--a23b0b97.md)，私有备份仓为延后事项见 [私有内容备份仓](2026-10-05-idea-private-content-backup--e405bfad.md)：`git rm --cached` 执行时 git 历史已保留内容出仓前的冻结快照，备份仓在此之前不阻塞迁移。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-3。

## Verification

`content-migrate` 执行后 `content` 表含 55 条且 `status: published`；`getArticleBySlug` 对三篇仍能取回双语正文与 `originalLang`；`content-schemas` 与 `content.config.ts` 共用同一份 zod 定义；`npm run build` 通过（本阶段 `src/content` 仍在 git 内）。

## Dependencies

T0（[note://f6f78001-d086-47ba-b627-787ada391296/a53dfd24-4a0a-4571-a964-93396c10d981](2026-10-05-task-t0-revoke-public-write--a53dfd24.md)）已落地。

## Allowed scope

`src/lib/content-schemas.ts`、`src/lib/content-store.ts`、`src/lib/article-db.ts`、`src/content.config.ts`、`scripts/content-migrate.mjs`
