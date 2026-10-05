---
schema: harness-note/1
id: d0a6d506-df77-4d90-b6f5-f8fb7144c726
kind: task
lifecycle: proposed
created: 2026-10-05
class: process
execution: pending
---

# T5 切断本地耦合并同步文档

## Scope

`.githooks/pre-commit` 删除 Obsidian 自动同步整段；`.githooks/pre-push` 删除 `npm run sync-kb`、KB diff 门禁与 `npm run fetch-articles:translate`——这三步要求本机存在 vault 与内容文件，是"没有 vault 的机器推不动"的直接原因，索引重建已由构建期 `init-db` 承担。`AUTOMATION.md` 同步更新。

`scripts/fetch-articles.mjs` 删除 `syncMarkdownFromRecord` 与 `writeArticleMarkdown` 及全部 `.md` 回写路径，改为把 `originalContent` 与 `translatedContent` upsert 进 `content` 表的 posts 记录，与 intake 通道同一写入口，杜绝译文双 master。`scripts/sync-obsidian-kb.mjs` 增加 `--to-lancedb`，从写本地目录改为 upsert `content` 表，Obsidian 降为可选输入源；导入按选定条目进行，禁止整库自动同步——vault 中存在未发布的私人笔记。

同步 `wiki/02-architecture.md`、`wiki/04-content-model.md`、`wiki/06-interactive-admin.md`、`wiki/07-pipeline-mcp.md`、`docs/blogX_x.md` 与 `.hybrid/status.json`，使工程 wiki 与新架构一致。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-8 的剩余部分。

## Verification

一台没有 Obsidian vault 的机器 `git pull` 后 `npm run build` 通过；`pre-commit` 与 `pre-push` 不再引用 `sync-kb` 或触碰 `src/content/knowledge-base`；`npm run fetch-articles` 运行后 `git status` 干净；LanceDB 不可达时已部署站点可正常访问，本地 dev 用上次拉取的 `src/content` 可启动。

## Dependencies

T4（[note://f6f78001-d086-47ba-b627-787ada391296/d5d2cc71-8987-47a2-870f-8c3c1e7f7e42](2026-10-05-task-t4-ai-intake--d5d2cc71.md)）已落地。

## Allowed scope

`.githooks/pre-commit`、`.githooks/pre-push`、`AUTOMATION.md`、`scripts/fetch-articles.mjs`、`scripts/sync-obsidian-kb.mjs`、`wiki/02-architecture.md`、`wiki/04-content-model.md`、`wiki/06-interactive-admin.md`、`wiki/07-pipeline-mcp.md`、`docs/blogX_x.md`、`.hybrid/status.json`
