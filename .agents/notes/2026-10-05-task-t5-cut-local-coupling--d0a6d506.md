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

**`pre-commit` 已提前收口（本任务 Scope 缩减）**。Main Agent 在 T3 落地前派发跨任务修复：`.githooks/pre-commit` 中的 Obsidian 自动同步整段已删除，该钩子现为 shebang + 说明注释 + `exit 0`。原因是 T2 之后该钩子的存在前提消失——它唯一的工作是把 vault 同步进 git 工作区并暂存，而 `src/content/` 已被 `.gitignore:6` 忽略，`spawnSync("git", ["add", "--", "src/content/knowledge-base"])` 恒被拒，导致**任何 `git commit` 都以 exit 1 中止**（已实证：`The following paths are ignored by one of your .gitignore files: src/content` → `git add failed for knowledge-base content` → `[pre-commit] Sync failed, commit aborted.`）；且 `src/content` 只是构建期由 content-pull 清空重建的产物目录，既无跟踪文件可暂存，同步进去的内容也会被下一次 content-pull 冲掉。原「检测到手动暂存就跳过」分支一并删除，其判据对象已永久不存在。

**仍待本任务收口**：`.githooks/pre-push` 的 `npm run sync-kb`、`git diff --quiet -- src/content/knowledge-base` 门禁（`.githooks/pre-push:36`）与 `npm run fetch-articles:translate`；`package.json` 的 `sync-kb:stage` 死入口（已无调用方，单独运行仍 exit 1）；`sync-kb:check` 假绿门禁（实测路径不被追踪时 `git diff --quiet` 恒为空、恒通过，确认假绿为真）；以及 `AUTOMATION.md`、`wiki/02-architecture.md`、`wiki/07-pipeline-mcp.md` 中关于同步步骤的过期文档。`README.md` 同样过期但不在本任务 Allowed Scope 内，需另立项。

`scripts/fetch-articles.mjs` 删除 `syncMarkdownFromRecord` 与 `writeArticleMarkdown` 及全部 `.md` 回写路径，改为把 `originalContent` 与 `translatedContent` upsert 进 `content` 表的 posts 记录，与 intake 通道同一写入口，杜绝译文双 master。`scripts/sync-obsidian-kb.mjs` 增加 `--to-lancedb`，从写本地目录改为 upsert `content` 表，Obsidian 降为可选输入源；导入按选定条目进行，禁止整库自动同步——vault 中存在未发布的私人笔记。

同步 `wiki/02-architecture.md`、`wiki/04-content-model.md`、`wiki/06-interactive-admin.md`、`wiki/07-pipeline-mcp.md`、`docs/blogX_x.md` 与 `.hybrid/status.json`，使工程 wiki 与新架构一致。

**跨任务观察项（T2 评审提出）**：`package.json` 的 `sync-kb:check` 执行 `node scripts/sync-obsidian-kb.mjs && git diff --quiet -- src/content/knowledge-base`。内容出仓后 `src/content/knowledge-base` 不再被 git 追踪，该 diff 恒为空、检查恒通过，成为一个假绿的门禁。本任务处理同步链路时须一并处置：删除该脚本入口，或改为对 `content` 表的校验，不得留一个永不失败却看似在把关的检查。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-8 的剩余部分。

## Verification

一台没有 Obsidian vault 的机器 `git pull` 后 `npm run build` 通过；`pre-commit` 与 `pre-push` 不再引用 `sync-kb` 或触碰 `src/content/knowledge-base`；`npm run fetch-articles` 运行后 `git status` 干净；`sync-kb:check` 的假绿问题已处置且处置方式写进 note；LanceDB 不可达时已部署站点可正常访问，本地 dev 用上次拉取的 `src/content` 可启动。

## Dependencies

T4（[note://f6f78001-d086-47ba-b627-787ada391296/d5d2cc71-8987-47a2-870f-8c3c1e7f7e42](2026-10-05-task-t4-ai-intake--d5d2cc71.md)）已落地。

## Allowed scope

`.githooks/pre-commit`、`.githooks/pre-push`、`AUTOMATION.md`、`scripts/fetch-articles.mjs`、`scripts/sync-obsidian-kb.mjs`、`package.json`、`wiki/02-architecture.md`、`wiki/04-content-model.md`、`wiki/06-interactive-admin.md`、`wiki/07-pipeline-mcp.md`、`docs/blogX_x.md`、`.hybrid/status.json`
