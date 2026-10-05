---
schema: harness-note/1
id: 675d3c93-ff83-4706-a244-4637bee6dadf
kind: requirement
lifecycle: proposed
created: 2026-10-05
class: architecture
---

# 内容云化需求：真相源迁出仓库，管理入口落在持有密钥的机器

## Goal

BlogX_x 的全部集合内容以 LanceDB Cloud 单表 `content` 为唯一真源，公开仓库只保留代码、UI 与机制。任何机器 clone 仓库并在 `.env` 配置 `LANCEDB_*`、`GLM_API_KEY`、`UPSTASH_*` 之后，必须能够构建出完整站点并对全部集合进行增改删与发布。公网写入面为零。

## Acceptance criteria

- [ ] AC-1: 生产环境下 `/admin` 与 `/api/admin` 一律返回 404，公开写入面为零。
- [ ] AC-2: 公开仓库不追踪任何内容文件；一台干净机器 `git clone` 后凭既有 env 可 `npm run build` 出完整站点。
- [ ] AC-3: 内容唯一真源为 `content` 表，文章双语正文并入 posts 记录；`articles` 表废弃，不存在第二份正文 master。
- [ ] AC-4: 私有备份仓保有全量内容与 git 历史，`content:restore` 可从备份完整还原 `content` 表。**延后**，见 [私有内容备份仓](2026-10-05-idea-private-content-backup--e405bfad.md)。
- [ ] AC-5: posts、knowledgeBase、wiki、repos、projects、skills、toolbox 七个集合可从 dev 面板或 CLI 增改删；发布后经 Deploy Hook 触发重建，1–2 分钟内线上可见。
- [ ] AC-6: 草稿态记录 `status: draft` 落在 `content` 表，跨机器可见，不依赖本地文件。
- [ ] AC-7: 粘贴 URL 或正文，AI 提取 frontmatter、摘要、标签与双语正文，落为草稿并预览，确认后一次发布。
- [ ] AC-8: 无 Obsidian vault 的机器 `npm run build` 通过；`fetch-articles` 运行后不产生任何文件变更；LanceDB 不可达时已部署站点继续服务，本地 dev 可用上次拉取的磁盘内容启动。

## Non-goals

公网管理面板不在范围内。多用户与操作审计不做。不引入 LanceDB 与 Upstash 之外的存储服务。`glob` loader 与 prerender 策略不变。不做 `content` 分支或 PR 评审流程。skill 的 zip 二进制继续留在公开仓，不视为文章内容。
