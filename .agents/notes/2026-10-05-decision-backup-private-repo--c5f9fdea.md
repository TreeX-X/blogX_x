---
schema: harness-note/1
id: c5f9fdea-b133-42d0-bef2-8a6360d2ee40
kind: decision
lifecycle: proposed
created: 2026-10-05
class: architecture
---

# 决策：内容全量备份至私有仓

## Context

内容离开 git 后，LanceDB Cloud 成为唯一副本。LanceDB 故障不影响已部署站点，但会使新部署失败，且任何数据丢失都不再有 git 历史可依。备份必须在内容迁移完成的同时建立，不能延后。

## Decision

内容全量备份至一个私有仓库。`scripts/content-backup.mjs` 从 `content` 表导出 markdown 并提交到该私有仓，`scripts/content-restore.mjs` 从私有仓灌回 `content` 表。PAT 以 fine-grained 权限仅授予该私有仓 `contents:write`，只存在于 `.env` 与 Vercel env。建议每次发布后执行一次备份。

本决策当前延后，不阻塞内容迁移：内容先全部落入 LanceDB，且 `git rm --cached` 执行时 git 历史已保留内容出仓前的冻结快照，私有仓在此之后建立。延后事项见 [私有内容备份仓](2026-10-05-idea-private-content-backup--e405bfad.md)。

## Alternatives considered

导出到本地目录：零配置，但备份与源在同一台机器上，不构成第二副本。

私有仓加本地双备份：最稳，代价是维护两套，当前阶段收益不成比例。

不做备份：接受内容随 LanceDB 单点丢失，不接受。

## Consequences

多一个仓库与一个 PAT 需要管理。备份仓含全量正文，体积随内容增长，git 历史需要定期关注。回滚路径由 `content:restore` 到指定 commit 提供，比 LanceDB 侧的手工 upsert 可靠。

## Revisit signals

备份仓长期未与 `content` 表同步；备份体积影响 git 历史；需要按时间点的自动保留策略。
