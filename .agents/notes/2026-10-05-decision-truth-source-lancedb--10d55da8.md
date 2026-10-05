---
schema: harness-note/1
id: 10d55da8-1067-4c91-947d-ef07188cb207
kind: decision
lifecycle: proposed
created: 2026-10-05
class: architecture
---

# 决策：内容真相源为 LanceDB 单表

## Context

内容今天分居三地：git 中的 frontmatter 与一份失真正文副本、LanceDB `articles` 表中的双语正文、本地 Obsidian vault 中的知识库真源。三者互不同步——`fetch-articles.mjs` 在构建期把译文回写 `.md`，与 LanceDB 形成双 master，实测三篇的 git 正文与 LanceDB 译文在字符数上双向不一致（5.4KB/14.6KB、12.8KB/6.2KB、英文原文 38KB 译文）。任何新机器都无法仅凭仓库与密钥恢复或管理全部内容。

## Decision

以 LanceDB Cloud 单表 `content` 为唯一真源，记录字段为 `collection`、`path`、`frontmatter`（JSON）、`body`、`originalBody`、`translatedBody`、`status`、`updatedAt`。文章双语正文并入 posts 记录，`article-db.ts` 改查该表，`articles` 表在验证通过后废弃。`blog_index` 保持派生索引。

## Alternatives considered

维持三地分存（零改动）：新机器仍无法管理内容，失真副本继续漂移，`--to-cloud` 之类的迁移会在同一处复演双 master。

git-as-CMS，内容提交进远端 git：保留 git 历史与回滚，代价是 PAT 权限面、分支策略、并发写控制，且正文仍进公开仓库；与"公开仓只留机制"的目标冲突。

Redis/KV 或 Vercel Blob 为真源：需重写六个集合的读取链路，并新引一个存储服务，收益仅是发布延迟。

## Consequences

站点构建强依赖 LanceDB 可达；LanceDB 故障不影响已部署站点（Vercel 继续 serve 上一个成功部署），仅使新部署失败。本地 dev 在拉取过一次后，可用磁盘上的旧内容离线启动。内容备份职责转移到私有仓，见 [备份决策](2026-10-05-decision-backup-private-repo--c5f9fdea.md)。

## Revisit signals

LanceDB Cloud 出现持续不可用或配额限制；出现离线构建需求；内容量增长到单表全量 scan 不再经济的区间；需要秒级发布。
