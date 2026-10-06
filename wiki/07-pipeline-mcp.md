# 07 — Pipeline, Automation & MCP

## Content pipeline（内容真相源 → 构建产物）

| Script | 方向 | 说明 |
|--------|------|------|
| `scripts/content-pull.mjs`（`npm run content:pull`） | `content` 表 → `src/content/**` | `predev` / `prebuild` 自动跑。拉 `status: published` 按原嵌套路径写盘；`draft` 不写盘。先清空再写入是硬要求：残留文件会被 glob loader 收进来。拉不到记录且磁盘无旧内容时直接失败——空站点比失败更难发现 |
| `scripts/content-migrate.mjs`（`npm run content:migrate`） | 遗留 `src/content/**` → `content` 表 | **一次性脚本**，迁移早已完成，只作应急保留。输入表 `articles` 即将废弃（站点侧零读取方），它靠该表补 posts 的双语正文 |
| `scripts/content-intake.mjs` / `content-publish.mjs` | 输入 → `content` 表 → 发布 | AI 上传通道与发布链，实现只有 `src/lib/article-intake.service.ts` 一份，面板与 CLI 共用。CLI 另带 intake 门禁：`intake.status: "failed"` 的草稿默认拒绝发布，`--force` / `--allow-warnings` 显式覆盖（人工修订后 `intake.warnings` 不会自动清除，没有覆盖入口草稿会被永久锁死）；`--dry-run` 不受门禁限制，正是用来看该改什么的 |

## Obsidian vault → knowledgeBase（按条目导入）

| Item | Detail |
|------|--------|
| Script | `scripts/sync-obsidian-kb.mjs` |
| npm | `sync-kb`（列候选）、`sync-kb:import`（导入） |
| Target | LanceDB `content` 表，`collection: knowledgeBase` |
| Source | `OBSIDIAN_KB_PATH`（默认本机 vault；没有 vault 的机器不需要它） |
| 用法 | `npm run sync-kb:import -- --only "AI使用技巧/AI评选.md"`（可重复 `--only`） |

导入**必须按条目选择**：vault 里有从未发布的私人笔记（`思路记载/未命名.md`，已由
`.git/info/exclude` 本地排除，且其图片链接在本机不存在）。整库自动同步已禁用——不给 `--only`
时脚本只列候选、什么都不写；`--only all` / `--only '*'` / `--only .` 一律拒绝；排除清单里的
条目即使被点名也拒绝。历史教训见 T1 的 Known items：一篇被旧钩子同步进来的私人笔记引用不存在
的图片，令 `astro build` 抛 `ImageNotFound`，整个构建失败。

已移除：写 `src/content/knowledge-base` 的本地目录模式（那是构建产物，写进去会被 content-pull
冲掉）与 `--stage`（`git add` 被 ignore 拒绝，单独运行即 exit 1）。

幂等：按 `(knowledgeBase, path)` 先删后插。已存在记录的 `status` 原样保留（导入绝不把在架条目
撤下站点）；新记录默认 `published`——选择条目的是人，这一步就是发布动作。

## Article fetch / translate

| Script | Role |
|--------|------|
| `scripts/fetch-articles.mjs` | 按 `sourceUrl` 刷新 `content` 表 posts 记录的双语正文 |
| `src/lib/article-intake.service.ts` | 抓取 + 富媒体翻译 + GLM 提取 + 校验发布的唯一实现 |
| `src/lib/article-translation.service.mjs` | GLM 翻译与语言检测的唯一实现 |
| `src/lib/article-db.ts` | posts 详情页读取（读 `content` 表，不再读 `articles` 表） |

`fetch-articles` 不再扫描 `src/content/posts`（枚举源改为 `content` 表本身，草稿也在表里），
不再 upsert `articles` 表，不再回写任何 `.md`。默认只补缺：`originalBody` 或 `translatedBody`
为空（或译文与原文同语言，即上次翻译失败）的记录才会被刷新——**前提是语料已完整**：对已完整的
文章，`npm run build` 里的这一步是空转，不打 GLM、不写云端；一旦有记录缺译文（面板新建后直接
发布、或 GLM 曾失败），这一步就会重试它。`--force` 全部重来，`--dry-run` 只看不写。

失败不静默，退出码分情形：抓取失败时原记录一个字节都不动（旧版会写一条空正文的失败记录，把好
数据冲掉）；翻译失败时保留原有译文，把 intake 记下的原因逐条念出来，汇总里再列出受影响的
slug。退出码 1 保留给三种情形——显式 `--force` 刷新失败、译文从合格退化为不合格（回归）、抓取
失败；构建期只是给"本来就缺"的记录补缺而失败时只报告、不阻断构建：构建期不该对 intake 期的
配额失败负责，那道门禁落在发布期（见上表 `content-publish` 一行的 intake 门禁）。"本来就缺"与
"被改坏"用同一个判据区分——刷新前的译文状态，与"只补缺"的筛选共用 `hasCompleteBilingual` 一个
谓词。产物一律带 `frontmatter.intake`（成败自述），与面板草稿同一约定。

## Vector index

| Item | Detail |
|------|--------|
| Script | `scripts/init-db.mjs` |
| npm | `init-db`（`build` 的第一步） |
| Helpers | `scripts/check-lancedb.mjs`, `scripts/test-knowledge-graph.mjs` |
| 输入 | `src/content/{posts,knowledge-base,wiki}`（构建期产物，所以 build 前必须先 content-pull） |

### Remote CI

`.github/workflows/vector-sync.yml` 在 `scripts/init-db.mjs`、`package.json`、lockfile 或
workflow 自身变更时跑 `npm run init-db`。runner 上是干净 checkout、`src/content/**` 为空，
此时 `init-db` 打印"未找到 Markdown 文件，已跳过"——要让 CI 真正重建索引，得先在 workflow 里
补一步 content-pull。

## Local git hooks（`AUTOMATION.md` 有完整版）

1. **pre-commit**：内容出仓后无事可做，现为注释 + `exit 0`。
2. **pre-push**：只跑 `npm run maintenance:fix`（本地库自检，不碰 vault、不碰 KB、不碰云端）。
   `sync-kb`、KB diff 门禁、`fetch-articles:translate`、`init-db` 均已移除，理由见
   `AUTOMATION.md`。
3. Hook install: `prepare` → `scripts/setup-git-hooks.mjs`

## Maintenance

| Item | Detail |
|------|--------|
| Script | `scripts/maintenance.mjs` |
| npm | `maintenance` / `maintenance:status` / `maintenance:fix` / `maintenance:verify` |
| 检查对象 | `content` 表（内容真源，status 会只读探测云端）与 `blog_index`（派生索引，本地） |
| `fix` | 只删"坏了该重建"的派生索引；**绝不删 `content` 表**——它没有重建路径 |
| `reset` | 本地表重置（需 `--confirm`），跳过 `content` 表 |
| `articles` 表 | 已废弃，本工具不再检查它 |

## Skills packaging

- `scripts/pack-skills.mjs` on `prebuild`
- Output under `public/skills-download/`
- Skill metadata in `content` 表 `skills` 集合

## MCP (knowledge base)

| Mode | Command | Notes |
|------|---------|--------|
| stdio | `npm run mcp:kb` → `scripts/kb-mcp-server.mjs` | tools + resources |
| HTTP | `npm run mcp:kb:http` → `scripts/kb-mcp-http-server.mjs` | default `http://127.0.0.1:8787/mcp` |

数据源是磁盘上的 `src/content/knowledge-base` 与 `src/content/wiki`，也就是构建期产物——
启动 MCP 前先跑一次 `npm run content:pull`（或 `npm run dev` 的 predev），否则读到空库。

### Tools

- `search_knowledge_base`
- `read_knowledge_base_entry`
- `list_knowledge_base_entries`

### Resources

- `kb://knowledge-base/...`
- `kb://wiki/...`

Longer notes: `docs/mcp-knowledge-base.md`. Project MCP config may also live in `.mcp.json`.

## Maintenance

- `scripts/maintenance.mjs` — `status` / `fix` / `reset` / `verify`
- 检查对象：`content` 表（内容真源）与 `blog_index`（派生索引）。`articles` 表已废弃，不再检查
- `scripts/lib/logger.mjs` — shared logging

## Env cheat sheet

| Var | Used for |
|-----|----------|
| `OBSIDIAN_KB_PATH` | 本地 vault 路径（仅 `sync-obsidian-kb.mjs`；没有 vault 的机器不需要它） |
| `LANCEDB_URI` / `LANCEDB_API_KEY` | 云端 content 表与向量索引；缺失时降级本地，写路径拒绝降级 |
| `LANCEDB_TABLE` | 向量索引表名，默认 `blog_index` |
| `LANCEDB_LOCAL_PATH` / `LANCEDB_CLOUD_REQUIRED` | 本地库目录 / 禁止降级 |
| `SF_TOKEN` / `EMBEDDING_DIM` | 向量嵌入 |
| `GLM_API_KEY` / `GLM_MODEL` | 翻译、AI 搜索、intake 提取 |
| `VERCEL_DEPLOY_HOOK` | 发布后触发重建（表的变更不触发 git push） |
| Vercel KV / Redis | Messages & ideas |
