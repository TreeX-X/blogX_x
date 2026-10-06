---
schema: harness-note/1
id: d0a6d506-df77-4d90-b6f5-f8fb7144c726
kind: task
lifecycle: implemented
created: 2026-10-05
class: process
execution: completed
---

# T5 切断本地耦合并同步文档

## Scope

**`scripts/fetch-articles.mjs` 改为写 `content` 表并收敛实现**：删除 `syncMarkdownFromRecord` 与 `writeArticleMarkdown` 及全部 `.md` 写路径；不再 upsert `articles` 表，改为 upsert `content` 表的 posts 记录（`originalBody`/`translatedBody` 与 `frontmatter`），与 intake 通道同一写入口；脚本内那份约 200 行的抓取与富媒体翻译副本删除，改用 `src/lib/article-intake.service.ts` 的 `createIntakeDraft`。806 行 → 252 行。默认只补缺（`--force` 强制全部刷新）；抓取失败保持记录逐字节不变；翻译失败保留旧译文、逐条打印 intake 原因并 exit 1。`--translate` 降级为空 flag（`fetch-articles` 与 `fetch-articles:translate` 内容相同），`--force-translate` 显式 exit 1 并说明"无法只重译不重抓"。`package.json` 的 `build` 去掉 `--translate`，`fetch-articles*` 两条入口加 `--experimental-strip-types`（TS import）。

**`scripts/sync-obsidian-kb.mjs` 增加 `--to-lancedb`**：从写本地目录改为按条目 upsert `content` 表。`--list` 列候选并把私人笔记标为"🚫 排除"；选择方式是 `--only <相对 vault 的路径>`（可重复，带不带 `.md` 都认）；不给 `--only`、或写 `all`/`*`/`.`、或点名排除项，全部 exit 1 拒绝。`--stage` 与本地目录/`git add` 路径一并删除（`LOCAL_KB_CONTENT_DIR` 随之消失）。已存在记录的 `status` 原样保留。

**`scripts/maintenance.mjs` 的被检查表从 `articles` 改为 `content`**：`status` 增加对云端 `content` 的只读探测（行数 + 逐集合分布）；`fix` 仍会删除损坏的 `blog_index`（派生索引，可重建）但**拒绝自动删除 `content`**（内容唯一真源，无重建路径）；`reset` 跳过 `content`；`fix`/`reset` 保持只连本地库，pre-push 因此永不触云。

**`.githooks/pre-push`**：删除 `npm run sync-kb`、`git diff --quiet -- src/content/knowledge-base` 门禁与 `npm run init-db`、`npm run fetch-articles:translate`，只保留 `maintenance:fix`。删 `init-db` 的理由：`blog_index` 是内容派生索引，而 git push 不再等于内容变更（内容变更发生在云端表，push 只是代码），用工作区里那份构建期产物覆盖共享云端索引等于把 stale 数据写进公共状态；新机器上 `src/content/**` 为空时 `init-db` 只会打印"未找到 Markdown 文件，已跳过"，这道检查本身是空的。索引改由 `npm run build`（先 content-pull 再 init-db）与 `vector-sync.yml` 重建。

**`package.json` 清理**：删除 `sync-kb:stage`（死入口，单独运行 exit 1）与 `sync-kb:check`（假绿门禁）；`sync-kb` 改为 `--list`，新增 `sync-kb:import`。

**`scripts/content-migrate.mjs`**：仅头部注释，注明它是一次性迁移脚本、其输入表 `articles` 已废弃、这也是该表暂时不能 drop 的唯一原因。

**文档同步**：`AUTOMATION.md`、`wiki/02-architecture.md`、`wiki/04-content-model.md`、`wiki/06-interactive-admin.md`、`wiki/07-pipeline-mcp.md`、`docs/blogX_x.md`、`README.md`、`.hybrid/status.json` 共八份。README 的改动限于第 92、257、258 行一带的过期命令说明（`npm run sync-kb` / `sync-kb:stage`）。

**F-1 / F-2 修复（Attempt 2，只修两条失败项，`src/**` 未动）**：

- **`scripts/fetch-articles.mjs` 退出码分情形**：构建期只给"本来就缺"的记录补缺，失败只报告；exit 1 明确保留给三种情形——`--force` 显式刷新失败、译文**从合格退化为不合格（回归）**、抓取失败。区分"本来就缺"与"被改坏"的判据是**刷新前的译文状态**，与"只补缺"的筛选共用同一个谓词 `hasCompleteBilingual`（一处定义两处使用，判据不会漂移）。汇总新增一行 `译文仍缺/陈旧的记录` 列出受影响 slug，判据与查询路径写在紧随的 warn 里。
- **写回失败与抓取失败分开记账**：原文已取到但没落库（最常见是 `content-store` 在降级连接上拒绝写入）原先被记进"抓取失败"——既说错事实，又把构建期补缺拖成 exit 1。现在单独一栏 `写回失败`，构建期只报告、`--force` 下 exit 1。落库失败时磁盘一个字节都没变，所以记账按"刷新前状态"算：本来就缺的仍计入 stale，刷新前合格的**不**计回归。
- **`scripts/content-publish.mjs` 发布前 intake 门禁**：`intake.status === "failed"` 的草稿**默认拒绝发布**，`--force` / `--allow-warnings` 显式覆盖，拒绝信息里逐条念原因并说明怎么覆盖；`--dry-run` 不受门禁限制（dry-run 的目的正是看这条草稿能不能发、该改什么）。
- **四条失败路径改用自然排空**：`scripts/lib/logger.mjs` 新增 `fail()`（打印 ❌ 并置 `process.exitCode = 1`），`fetch-articles`、`content-pull`、`content-intake`、`content-publish` 的 failure 路径全部改走它，不再 `process.exit(1)`。`fetch-articles` 的 `--force-translate` 守卫从模块顶层搬进 `main()`，与其它失败共用同一个出口。
- **文档**：`AUTOMATION.md`（`fetch-articles` 段 + Content management 表格的 `content:publish` 行）、`wiki/07-pipeline-mcp.md`（content pipeline 表格的 `content-publish` 行 + Article fetch / translate 段）按新退出策略改写。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-8 的剩余部分。

## Verification

2026-10-06 在本机（Windows 11，HEAD `f634e57`，LanceDB Cloud 真连）实跑。

**类型检查与构建**：`npx astro check` 报 10 errors、0 warnings，与基线逐文件一致（`kv-messages.ts` 2、`api/fun-messages.ts` 2、`index.astro` 1、`nav-particles.ts` 5）；`content-schemas.ts` 的 4 条 `z.string().url()` 弃用提示是 warning 不是 error。`npm run build` 两次均 exit 0、以 `Complete!` 结束；跑完后 `git status --short src/content` 为空——**`fetch-articles` 不再回写任何 `.md`**，这是本任务的核心证据。

**`fetch-articles` 两种模式**：不带 flag 与带 `--translate` 行为完全相同，都读云端 `content` 表，3 条 posts 全部命中"已有完整双语正文，跳过"，`待刷新 0 条`、0 次写入、exit 0。`articles` 表行数保持 73，无新写入。

**GLM 429 三问（三种方式实证，结论一致）**：①`--force --dry-run` 打真流水线 + 真 key（真 429）：`0 条抓取失败、3 条翻译失败` → exit 1；②`--force` 打一次性本地库 + `GLM_API_KEY` 置空，识别出"`translateText` 返回占位译文"这条静默失败路径；③同一个一次性本地库 + 本地 mock GLM 服务，补上"翻译成功"分支：en→zh 与 zh→en 两个方向都只写 `content` 表、`tableNames()` 只有 `['content']`（**不创建 `articles` 表**）、`path`/`status`/顶层 frontmatter 原样保留、`fetched` 与 `intake` 刷新、exit 0。

失败时的可见性与数据保全：每条 posts 先打 `⚠️ <path> — 未采用本次译文，保留原有译文（6167 字符）`，随后 `译本语言与原文相同（en），疑似未真正翻译`，再逐条打印 intake 原因（正文翻译失败/译文与原文逐字相同、GLM frontmatter 提取失败/HTTP 429 余额不足），末尾汇总"原有译文原样保留，站点渲染不受影响，但译文不是最新的"。**旧译文一字节未变**：`translatedBody` 14592/37961/6167 与 `body` 2204/37962/6365 前后完全一致，三条 `updatedAt` 也未被改写。

**`.githooks/pre-push`**：`sh .githooks/pre-push` exit 0，只跑 `maintenance:fix`（本地库自检），不再触碰 vault、不再触碰 `src/content/knowledge-base`、不连云端。

**`maintenance:status`**：输出 `content: 健康 (62 条记录)` + `集合分布: knowledgeBase 15 · posts 3 · projects 2 · repos 5 · skills 5 · toolbox 3 · wiki 29`；本地一节检查 `blog_index`；末尾一行"articles 表已废弃（站点侧零读取方），本工具不再检查它"。

**`sync-kb` 新入口与拒私**：`--to-lancedb --help` exit 0 打印用法；`--list` 列 16 个候选，把 `思路记载/未命名.md` 标为"🚫 排除（私人笔记）"、其余 15 条标"可导入"。实证（一次性本地库，种子从云端只读复制 15 条 knowledgeBase）：`--only "思路记载/未命名.md"` → `❌ 在私人笔记排除清单中，拒绝导入` + exit 1，表内该 path 0 行；`--only all` / `--only '*'` / `--only .` / 不给 `--only` 全部 exit 1；`--stage` 也 exit 1 并说明原因。导入成功形态：`AI使用技巧/AI评选 — 已写入 content 表（knowledgeBase，status published）`，已存在且内容未变的记录跳过。

**索引与出仓未被破坏**：`git ls-files src/content` = 0，`src/content.config.ts` 仍在索引内。

**数据面终态**：云端三表 `articles`(73) / `blog_index`(51) / `content`(62)；`content` 62 条全 published、0 draft、0 scratch，三条 posts 的 `updatedAt` 与基线逐字相同（本次任务没有写入过它们），knowledgeBase 15 条不含 `思路记载/未命名`。

### F-1 / F-2 修复验证（Attempt 2）

2026-10-06 在本机（Windows 11，HEAD `f634e57`，Node `v24.14.1`）实跑。**云端 `content` 表全程只读**，所有写操作都打到一次性本地库（`LANCEDB_URI` 指向一次性目录 + 占位 key，这样 `content-store` 的 `assertWritable` 才放行写入）；GLM 不可活用 `GLM_BASE_URL=http://127.0.0.1:9/v1` 模拟——undici 立即报 `bad port`，等价于"配额/网络全不可达"，且不消耗任何真实配额。

**AC-1 构建期补缺失败不再 exit 1**：造一条 `translatedBody: ""` / `body: ""` 的 posts 记录（`originalBody` 36036 原样保留，另两条完整）→ `node scripts/fetch-articles.mjs`（无 flag）→ **exit 0**（整轮 301s，其中尾段约 300s 是 src 侧定时器泄漏导致的排空，见 Known items）。逐条失败原因与收尾汇总照旧：`⚠️ <slug> — 未采用本次译文，保留原有译文（0 字符）` → `译本语言与原文相同（en），疑似未真正翻译` → `intake: GLM frontmatter 提取失败: fetch failed`；汇总 `翻译失败 1`、`其中回归（刷新前合格） 0`、`译文仍缺/陈旧的记录: anthropic-harness-design-long-running-apps`。旧的耦合（"translationFailed > 0 就 throw"）下这一步会 exit 1——三条都完整只是让它从来没被触发。

换 dispatch 指定的寻址再测一次（清空 `LANCEDB_URI`/`LANCEDB_API_KEY`、`LANCEDB_LOCAL_PATH` 指向一次性库，即凭据缺失、连接降级到本地）→ 同样 **exit 0**，此时失败落在新拆出的 `写回失败: 1` 一栏（`content-store` 在降级连接上拒绝写入），`抓取失败: 0`、`其中回归 0`、slug 清单照旧。**注意这个寻址方式在本机 shell 里有一个坑**：本机 dotenvx 会把 `.env` 强制注入每个 node 进程，`env -u LANCEDB_URI` 之后 `dotenv.config()` 又把它们填回来；要真清空必须在 import 脚本之前把 `process.env` 里的值置空。

**AC-2 该 exit 1 的仍然 exit 1**：① 同一条记录加 `--force` → exit 1，`❌ 3 条译文从合格退化为不合格（回归）、--force 显式刷新，3 条翻译失败`；② 三条完整记录不带 flag → exit 0，三条 `⏭️ 已有完整双语正文，跳过`，`updatedAt` 与 `originalBody/translatedBody/body` 前后逐字相同（**0 写入**）；③ `sourceUrl` 全部指向不可达地址 + `--force` → exit 1，`抓取失败 3`、`译文仍缺/陈旧的记录: 无`。

**AC-3 受影响 slug 可枚举**：汇总新增 `译文仍缺/陈旧的记录` 一行，值是 slug 清单；紧随的 warn 写出判据（`originalBody` 非空而 `translatedBody` 为空或与其同语言）与原因位置（记录的 `frontmatter.intake`）。**没有引入新的存储位置**——"可查询"落在 content 表本身：就是对 posts 记录套这条判据，`content:intake --list` 的"⚠️ 失败"列与面板草稿箱用的是同一个 `frontmatter.intake.status`。

**AC-4 发布门禁 + 覆盖入口**：造一条 `intake.status: "failed"` 的草稿 → 默认 `❌ 拒绝发布：posts/<path> 带 intake 失败记录` + 逐条原因 + `确认内容已人工修订后，加 --force（或 --allow-warnings）重试即可发布`，**exit 1**；`--force` → `已置为 published` + `✅ 已发布`，**exit 0**；`--allow-warnings` 同样 exit 0（两个名字等价）；`--dry-run` 不被门禁挡住（exit 0，仍打 intake 失败警告）；`intake` 为空的记录直接发布、exit 0。

**AC-5 退出码 1 而非 127、无 libuv 断言**：四条脚本的失败路径逐条实测，全部 exit 1 且输出里没有 `Assertion failed`——`content-pull`（空库 + 无退避内容）、`content-intake --delete` 无 path、`content-intake` 无任何输入、`content-publish` 无 `--path`、`fetch-articles --force-translate`、以及 `fetch-articles` 上述三种失败。需要说明的是：**F-2 描述的 127 在本机无法复现**——本机 Node `v24.14.1` 的二进制里 `UV_HANDLE_CLOSING` 这个符号已经不存在（改前 11 次实跑也全是 exit 1），说明该断言在这个 Node 版本上已被编译掉。因此修复的价值不靠"复现后修好"来证明，而是把 `process.exit()` 这条触发路径本身去掉：改成 `process.exitCode = 1` 后实测退出码为 1、无断言输出、上一行 `❌ … N 条翻译失败` 在输出末尾清晰可见（旧代码里 `process.exit(1)` 紧跟其后，正是它可能把这一行挤出视野的原因）。

**AC-6 三处被证伪表述已改写**：`scripts/fetch-articles.mjs` 头部"失败不静默"段、`AUTOMATION.md` 的 `fetch-articles` 段、`wiki/07-pipeline-mcp.md` 的 Article fetch / translate 段，全部按"对已完整的语料是空转 + 三种情形 exit 1 + 构建期补缺失败只报告"重写，不再有无前提的"日常构建不打 GLM、不写云端内容表"。

**类型检查**：`npx astro check` → 10 errors / 0 warnings，与基线逐项一致（本任务未改任何 `src/**` 文件，结果不可能变化）。

**数据面终态**：云端 `content` 表 62 条未被本次验证写过一字；三条 posts 的 `updatedAt` 与 `originalBody/translatedBody/body` = 36036/14592/2204、16517/37961/37962、14160/6167/6365 与基线逐字相同。一次性库（`/tmp/fa-scratch/*`、仓库内 `.fa-scratch/`）与所有 scratch 记录跑完后已清理。

## Known items

- **`articles` 表未能 drop，卡在 `init-db.mjs:340-341`**。该表现在 73 行：三个真实 slug 各 23 行（69 行是历次构建因 delete 谓词从未命中而累积的失败代），另有 4 条 intake 探针 slug 各 1 行。站点侧已零读取方（Main Agent grep 确认），`content` 表的 posts 记录里存的正是当年挑出来的那一代，恢复价值接近于零。但 `scripts/init-db.mjs:340-341` 有 `/*-- 4. 确保 articles 表存在 --*/ await ensureTable(db, "articles", ...)`，**每次构建都会重新创建它**，而 `init-db.mjs` 不在本任务 Allowed Scope 内。因此本次不 drop：摘掉那两行之后再 drop，两个动作必须在同一批改动里，否则等于没删。`scripts/content-migrate.mjs` 对它的依赖已收敛为一处三件事（`loadPickedArticles` 读表挑代、`buildRecord` 填 posts 的 `originalBody`/`translatedBody`/`frontmatter.fetched`），表不存在时它只 warn 不抛错，汇总报 `posts 双语正文完整 0/3`。
- **`blog_index` 不清孤儿向量，已删除的草稿会一直留在 AI 搜索结果里**。`init-db` 是"写入 N、删除 0"的增量形态（`scripts/init-db.mjs:410-413` 按 `id` 删），对源里已不存在的记录不会主动清理。Main Agent 实测：清掉 4 条 intake 探针草稿后跑一次 `init-db`，`blog_index` 仍是 51 行、4 条探针向量仍在。这不是暂时陈旧，是真实的索引卫生缺陷——丢弃的草稿内容仍可被 `/api/ai-search` 与知识图谱检索到。考虑到 vault 里存在私人笔记、intake 通道又会产草稿，这一条建议按小任务修（改为 drop + overwrite 全量重建，或补一步孤儿清理）。
- **索引只在构建时重建，与未配置的 Deploy Hook 直接叠加**。`content:publish` 后若不触发 Vercel 重建，`blog_index` 就不更新——新内容进了 `content` 表却搜不到。用户需在 Vercel 项目 → Settings → Git → Deploy Hooks 创建 Hook 并把完整 URL 填进 `.env` 的 `VERCEL_DEPLOY_HOOK`（T4 已留占位），或每次发布后手动部署一次。
- **翻译已从构建期前移到 intake 期**：`build` 不再跑 `--translate`，`--translate` 现在是空 flag。若绕过 intake 通道直接往 `content` 表写 posts 记录，其 `originalBody`/`translatedBody` 需自备，`fetch-articles` 只做补缺不会凭空翻译。
- **`src/lib/article-db.ts` 中 `articles` 表的四个函数现已零调用方**：`getAllArticles`、`getArticlesByStatus`、`saveArticle`、`initArticlesTable`（Main Agent grep 确认），是 T1 迁移期的只读回退。该文件不在本任务 Allowed Scope 内，未删；后续可清理，其中 `getArticlesByStatus`（`:294`）与 `getRelatedContent`（`:395`、`:402`）还带着同族双引号 bug，见 T6。
- **（Attempt 2）门禁从构建期前移到发布期，这个设计错位是这样修的**：原来的形态是"翻译失败 → `fetch-articles` exit 1 → `npm run build` 整体失败"，等于让构建期对 intake 期的配额失败负责，而真正把文章推上线的发布期反而只 warn。两边都不对：构建期打了 GLM 也修不好一篇已经发布过的文章（那要到源头重新 intake），发布期才是"允许一篇没译完的文章上线"的那个动作。所以这次的修法是**把 exit 权收紧到三种情形**（`--force` 显式刷新失败、译文从合格退化为不合格、抓取失败），**把门禁搬到 `content-publish`**（`intake.status === "failed"` 默认拒绝发布）。代价是构建期对"译文陈旧"只有报告没有硬失败——弥补是 AC-3 那行 slug 清单，让状态可枚举而不是只在日志里。
- **（Attempt 2）人工修订后 `intake.warnings` 不会自动清除，草稿只能靠覆盖发布**：`intake.status` / `intake.warnings` 是 intake 通道写进 `frontmatter` 的自述，人工在面板或手工改完字段后没有任何一步会去清它。所以 AC-4 的门禁**必须**带覆盖入口，否则人工修订过的草稿会被永久锁死（这正是 T4 已识别的陷阱）。根治办法是面板编辑保存时清除 `intake.status` / `intake.warnings`——那要改 `src/pages/api/admin/_helpers.ts` 与面板保存路径，属 `src/**`，超出本包范围。在此之前，修订后发布一律走 `--force` / `--allow-warnings`。
- **（Attempt 2）`urn:blogx-x:intake:` 占位 `sourceUrl` 的记录永远不会被翻译，而且每次都被告知、但没有升级提示**（评审方焦点 2 结论）：粘贴正文 / 上传文件时没给 `--source-url`，intake 就写 `urn:blogx-x:intake:<path>` 占位（`src/lib/article-intake.service.ts:686`，为的是过 posts.sourceUrl 的必填 URL 校验且不在站点上成为假外链）。`fetch-articles` 只刷 `isHttpUrl` 为真的记录，于是这类草稿**永远不会**被补翻译；但每次跑 `fetch-articles` 都会为它打一行 `⏭️ sourceUrl 不是外链（urn:blogx-x:…），跳过`，只进 `跳过` 计数，既不阻断也不升级。要根治得给 posts 记录一个"占位 sourceUrl 需补真链接"的可见状态（`intake` 里加一项，或发布门禁也查它），属 `src/**`，未在本包内做。
- **（Attempt 2）写回失败默认不阻断构建，代价是构建期不再对"写不进 content 表"报警**：降级连接上 `content-store` 拒绝写入（`assertWritable`），原记录一个字节不变、站点照常渲染，所以构建期只报告；`--force` 下仍 exit 1。若希望这种情况在构建期也硬失败，把 `stats.writeFailed > 0` 单独加进 `failures` 即可——一行的事，本包按 AC-1 的口径选了不阻断。
- **（Attempt 2）`src/lib/article-translation.service.mjs:150-169` 每次 GLM 调用失败都泄漏一个 300 秒定时器，进程最长滞留约 5 分钟才自然排空**：`clearTimeout(timeout)` 写在 `await fetch(...)` 之后而不是 `finally` 里，`fetch` 一 reject 就直接进 catch，定时器没人清。实测一条 60 段的文章在 GLM 全失败时，`process.getActiveResourcesInfo()` 剩 30+ 个 `Timeout`，进程从打印完汇总到真正退出又等了约 300 秒（实测整轮 301s，其中尾段约 300s 是排空）。这在成功路径上早就存在（旧代码只有失败路径用 `process.exit(1)` 把它掩盖了），且 T5 首次实现的验证③用的是 mock GLM、`clearTimeout` 正常执行，所以当时没暴露。修法很小（把 `clearTimeout` 移进 `finally`），但在 `src/**`，超出本包范围。
- **（Attempt 2）其余脚本仍有多处 `process.exit(1)`，同一 teardown 形态未覆盖**：本次只修了包内的 `fetch-articles`、`content-pull`、`content-intake`、`content-publish` 四处。`scripts/maintenance.mjs:349`、`scripts/sync-obsidian-kb.mjs:97,458`、`scripts/content-migrate.mjs:344`、`scripts/pack-skills.mjs:81`、`scripts/setup-git-hooks.mjs:73`、`scripts/kb-mcp-server.mjs:631`、`scripts/kb-mcp-http-server.mjs:339,341` 仍是 `process.exit`，其中 `maintenance.mjs` 与 `sync-obsidian-kb.mjs` 同样连 LanceDB，理论上带着同一条竞态。要统一的话，把它们的失败路径也改走 `Logger.fail()` 即可（`kb-mcp-http-server` 的 `process.exit(0)` 是收到 SIGINT 后的主动退出，不适用）。
- **（Attempt 2）`content-publish` 的 intake 门禁只在 CLI，面板发布路径没有这道门禁**：门禁实现在 `scripts/content-publish.mjs`（`src/**` 不可改），而 `/api/admin` 的发布走 `src/pages/api/admin/intake.ts:85` 直接调 `publishIntakeDraft`，那里仍只把 intake 失败当 warning。要在面板侧一致，得把 `allowWarnings` 选项加进 `publishIntakeDraft` 的签名并在接口层透传。

## Dependencies

T4（[note://f6f78001-d086-47ba-b627-787ada391296/d5d2cc71-8987-47a2-870f-8c3c1e7f7e42](2026-10-05-task-t4-ai-intake--d5d2cc71.md)）已落地，`article-intake.service.ts` 持有抓取、富媒体翻译、GLM 提取与发布链的唯一实现。

## Allowed scope

`.githooks/pre-push`、`scripts/fetch-articles.mjs`、`scripts/sync-obsidian-kb.mjs`、`scripts/maintenance.mjs`、`scripts/content-migrate.mjs`（仅头部注释）、`package.json`、`AUTOMATION.md`、`wiki/02-architecture.md`、`wiki/04-content-model.md`、`wiki/06-interactive-admin.md`、`wiki/07-pipeline-mcp.md`、`docs/blogX_x.md`、`README.md`、`.hybrid/status.json`

**Attempt 2（F-1 / F-2 修复）实际改动面**：`scripts/fetch-articles.mjs`、`scripts/content-publish.mjs`、`scripts/content-pull.mjs`、`scripts/content-intake.mjs`、`scripts/lib/logger.mjs`（只加 `fail()` 一个方法，**没有新增文件**）、`AUTOMATION.md`、`wiki/07-pipeline-mcp.md`。未改 `src/**`、`.githooks/**`、`package.json` 及其余文档。
