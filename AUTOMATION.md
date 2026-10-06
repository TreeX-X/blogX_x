# Automation Flow

> **内容真相源是 LanceDB `content` 表。** `src/content/**` 由 `scripts/content-pull.mjs` 在
> `predev` / `prebuild` 从表里生成，是构建产物、不入 git（`.gitignore`）。仓库里只有代码、
> UI 与机制。任何机器 clone + 配好 `.env` 就能构建与管理，不依赖本机 Obsidian vault。
>
> 详见 `wiki/02-architecture.md`、`wiki/04-content-model.md`、`wiki/07-pipeline-mcp.md`。

## Build

| Script | Role |
|--------|------|
| `prebuild` | `content-pull.mjs`（content 表 → `src/content/**`）→ `pack-skills.mjs` |
| `build` | `init-db` → `fetch-articles`（只补缺，见下）→ `astro build` |

`content-pull` 是构建前置：拉不到 published 记录、磁盘上也没有可退避的旧内容时构建直接
失败（否则会静默推出一个空站点）。

`fetch-articles` 只刷 `originalBody`/`translatedBody` 缺失的 posts 记录，已完整的文章一律跳过——对
已完整的语料，日常构建不打 GLM、不写云端内容表。一旦有记录缺译文（面板新建后直接发布、或 GLM
曾失败），这一步会重试它；重试失败时逐条报告并在汇总里列出受影响的 slug，但**不再阻断构建**。
退出码仍为 1 的只有三种情形：`--force` 显式刷新失败、译文从合格退化为不合格（回归）、抓取失败。
详见 `wiki/07-pipeline-mcp.md`。

## Local hooks

Hook 安装：`prepare` → `scripts/setup-git-hooks.mjs`（设 `core.hooksPath=.githooks`）。

### pre-commit

内容出仓后无事可做。它唯一的工作曾是把 vault 同步进 git 工作区并暂存，而 `src/content/**`
已被 `.gitignore` 忽略，`git add` 恒被拒，导致任何 `git commit` 都以 exit 1 中止（已实证）。
现为说明注释 + `exit 0`。

### pre-push

| 步骤 | 说明 |
|------|------|
| `npm run maintenance:fix` | 本地库健康自检。只连本地 `.lancedb`、不碰云端、不依赖 vault 与内容文件；只删"坏了该重建"的派生索引，绝不删 `content` 表 |

已移除的四步，以及理由：

| 移除的步骤 | 理由 |
|------------|------|
| `npm run sync-kb` | 写 `src/content/knowledge-base`。那已是构建期产物，写进去会被下一次 `content-pull` 冲掉 |
| `git diff --quiet -- src/content/knowledge-base` | 路径不被追踪时比较恒为空、恒通过——假绿门禁（已实证） |
| `npm run fetch-articles:translate` | 产物是 content 表的 posts 记录，与本次 push 的代码无关；GLM 限流时它以 exit 1 挡住 push |
| `npm run init-db` | `blog_index` 是内容派生索引，而 git push 不再等于内容变更（内容变更发生在云端表）。用工作区里的构建期产物覆盖共享的云端索引，是在写 stale 数据。索引由 `npm run build` 与 CI 重建 |

## Remote (after push)

`.github/workflows/vector-sync.yml` 在 `scripts/init-db.mjs`、`package.json`、lockfile 或
workflow 自身变更时跑 `npm run init-db`，重建云端向量索引。

注意：runner 上是干净 checkout，`src/content/**` 为空（不入库），此时 `init-db` 打印
"未找到 Markdown 文件，已跳过" 并退出 0。要让 CI 真正重建索引，得先在 workflow 里补一步
`npm run content-pull`——这属于 workflow 自身的改动，不在本文件范围内。

## Content management (local, dev only)

内容写入面在公网为零：`/admin` 与 `/api/admin` 在生产由 `src/middleware.ts` 一律 404。
管理与导入都在持有密钥的机器上做：

| 入口 | 用途 |
|------|------|
| `npm run dev` → `/admin` | 七个集合的增改删 + 草稿箱（AI 上传：URL / 文件 / 粘贴正文） |
| `npm run content:intake` | CLI 版 AI 上传 → content 表 posts 草稿 |
| `npm run content:publish` | 校验字段 + intake 失败门禁（`intake.status: "failed"` 默认拒绝，`--force` / `--allow-warnings` 覆盖）→ `status: published` → 打 Vercel Deploy Hook |
| `npm run sync-kb` | 列出 Obsidian vault 里可导入的条目 |
| `npm run sync-kb:import -- --only "<相对路径>"` | 按条目把 vault 笔记导入 content 表（禁止整库） |
| `npm run fetch-articles [--force]` | 按 `sourceUrl` 刷新 posts 的双语正文 |
| `npm run content:migrate` | 一次性迁移脚本（旧 `src/content` → content 表），应急用 |

content 表的变更不会触发 Vercel 重建（git push 才触发），发布后要主动打 Deploy Hook
（`VERCEL_DEPLOY_HOOK`，见 `package.json` 顶部注释）。

## Environment Variables

| Var | Used for |
|-----|----------|
| `LANCEDB_URI` / `LANCEDB_API_KEY` | 云端 content 表与 blog_index（缺省时降级本地 `.lancedb`，写路径拒绝降级） |
| `LANCEDB_TABLE` | 向量索引表名，默认 `blog_index` |
| `LANCEDB_LOCAL_PATH` | 本地 LanceDB 目录，默认 `.lancedb` |
| `LANCEDB_CLOUD_REQUIRED` | `true` 时禁止降级到本地库 |
| `SF_TOKEN` / `EMBEDDING_DIM` | SiliconFlow 向量嵌入 |
| `GLM_API_KEY` / `GLM_MODEL` | 翻译、AI 搜索、AI 上传提取 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | 留言与点子 |
| `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` | dev 面板登录 |
| `VERCEL_DEPLOY_HOOK` | 发布后触发重建 |
| `OBSIDIAN_KB_PATH` | 本地 vault 路径，仅 `sync-obsidian-kb.mjs` 用；没有 vault 的机器不需要它 |
| ~~`LOCAL_KB_CONTENT_DIR`~~ | 已废弃：KB 不再写仓库目录，`sync-obsidian-kb.mjs` 直接写 content 表 |
