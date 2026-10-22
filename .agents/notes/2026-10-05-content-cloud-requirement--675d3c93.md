---
schema: harness-note/1
id: 675d3c93-ff83-4706-a244-4637bee6dadf
kind: requirement
lifecycle: proposed
created: 2026-10-05
updated: 2026-10-14T09:37:49Z
class: architecture
---

# 内容云化需求：真相源迁出仓库，管理入口落在持有密钥的机器

## Goal

BlogX_x 的全部集合内容以 LanceDB Cloud 单表 `content` 为唯一真源，公开仓库只保留代码、UI 与机制。任何机器 clone 仓库并在 `.env` 配置 `LANCEDB_*`、`GLM_API_KEY`、`UPSTASH_*` 之后，必须能够构建出完整站点并对全部集合进行增改删与发布。公网写入面为零。

## Acceptance criteria

- [x] AC-1: 生产环境下 `/admin` 与 `/api/admin` 一律返回 404，公开写入面为零。（T0/T3，生产产物探针实证）
- [x] AC-2: 公开仓库不追踪任何内容文件；一台干净机器 `git clone` 后凭既有 env 可 `npm run build` 出完整站点。（T1/T2，`git ls-files src/content` = 0）
- [x] AC-3: 内容唯一真源为 `content` 表，文章双语正文并入 posts 记录；`articles` 表废弃，不存在第二份正文 master。（T1/T5。表的物理 drop 仍卡在 `init-db.mjs:340-341` 每次构建重建它，见 T5 Known items；站点侧已零读取方、无第二份正文 master）
- [ ] AC-4: 私有备份仓保有全量内容与 git 历史，`content:restore` 可从备份完整还原 `content` 表。**延后**，见 [私有内容备份仓](2026-10-05-idea-private-content-backup--e405bfad.md)。
- [x] AC-5: posts、knowledgeBase、wiki、repos、projects、skills、toolbox 七个集合可从 dev 面板或 CLI 增改删。（T3 面板 + T4 CLI 闭环。**"发布后 1–2 分钟内线上可见"半句尚未成立**：Deploy Hook 未在 Vercel 配置，发布不触发自动重建，`blog_index` 只在下次 build 更新，见 T5 Known items）
- [x] AC-6: 草稿态记录 `status: draft` 落在 `content` 表，跨机器可见，不依赖本地文件。（T4）
- [x] AC-7: 粘贴 URL 或正文，AI 提取 frontmatter、摘要、标签与双语正文，落为草稿并预览，确认后一次发布。（T4）
- [x] AC-8: 无 Obsidian vault 的机器 `npm run build` 通过；`fetch-articles` 运行后不产生任何文件变更；LanceDB 不可达时已部署站点继续服务，本地 dev 可用上次拉取的磁盘内容启动。（T5 实跑验证）

## Non-goals

公网管理面板不在范围内。多用户与操作审计不做。不引入 LanceDB 与 Upstash 之外的存储服务。`glob` loader 与 prerender 策略不变。不做 `content` 分支或 PR 评审流程。skill 的 zip 二进制继续留在公开仓，不视为文章内容。

## 状态复核（2026-10-14）

复核结论（Main Agent 读码与记录核对，未实跑）：**重构主体完成；Obsidian 已无双向绑定，仅为可选输入源。**

- 数据流严格单向：Obsidian vault（可选）→ `sync-obsidian-kb --to-lancedb --only` 逐条点名导入 → `content` 表 → `content-pull`（prebuild/predev）→ `src/content/**`（构建产物，gitignore）。`sync-obsidian-kb.mjs` 零写盘、`fetch-articles` 零 `.md` 回写、全仓无任何写 vault 路径。与 [内容出仓决策](2026-10-05-decision-content-out-of-repo--a23b0b97.md) 一致。
- 任务面：T0–T5 已完成（`.hybrid/status.json` 与各 task note 一致）；T6（`getRelatedContent` 双引号查询 bug + `callGlmApi` 定时器泄漏）pending；AC-4 延后。
- 遗留项仍开放：`articles` 表未物理 drop（卡 `init-db.mjs:340-341`，摘除与 drop 须同批改）；`blog_index` 不清孤儿向量（已删草稿仍可被 AI 搜索/图谱检索）；Deploy Hook 未配置；`article-db.ts` 四个 `articles` 读取函数零调用方待清理。
- 本次复核发现站点用户侧文案仍宣称「Obsidian 知识库双向同步」（首页数字花园卡片、知识库列表页与详情页的「同步」措辞），与本需求现状不符，页面文案已随本次一并修正（首页 `description` 与 hero 副标题的「本地知识库」措辞同批收正）；wiki 模块文档中残留的「Obsidian sync」表述已一并改写（`wiki/01-identity.md`、`wiki/08-constraints.md`、`wiki/README.md`、`wiki/09-agent-workflow.md`）。
