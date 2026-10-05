---
schema: harness-note/1
id: 3680cc06-8960-4265-acb5-861ea4d931ae
kind: task
lifecycle: implemented
created: 2026-10-05
class: architecture
execution: completed
---

# T2 构建期拉取与内容出仓

## Scope

新增 `scripts/content-pull.mjs`：从 `content` 表拉取 `status: published` 的全部记录，**先清空再写入** `src/content/{posts,knowledge-base,wiki,repos,skills,projects}` 各目录后，按原嵌套路径写盘并生成 frontmatter。清空重建是硬要求：`src/content/**` 此后是构建产物，残留文件会被 glob loader 收进来并可能使整个构建失败。`status: draft` 记录不写盘。

`package.json` 中 `prebuild` 改为 `content-pull` 后接 `pack-skills`，新增 `predev`；脚本入口只新增 `content:pull` 与 `content:migrate`。`content:backup` 与 `content:restore` **不加**：对应脚本不存在，其决策（[备份决策](2026-10-05-decision-backup-private-repo--c5f9fdea.md)）与 AC-4 均已延后。

`.gitignore` 增加 `src/content/`，执行 `git rm -r --cached src/content` 使公开仓不再追踪任何内容文件（只移出索引，不删磁盘文件）。调整 `.github/workflows/vector-sync.yml`：删去三条 `src/content/**` push 触发路径，保留 `scripts/init-db.mjs`、`package.json`、`package-lock.json`、工作流自身与 `workflow_dispatch`。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-2，以及 AC-8 中关于构建与 LanceDB 降级的部分。

## Verification

2026-10-05 由 coderX 实施、evaluatorX 独立评审（除 F-1 外全 PASS）、Main Agent 独立复核。

**内容出仓生效**：`git ls-files src/content` = 0（改前 59）；`git check-ignore -v` 命中 `.gitignore:6:src/content/`；`src/content.config.ts` 仍在索引内且未被 ignore 命中；`.gitignore` 内 `!.env.example`、`!.vscode/*`、`!.github/workflows/**` 三条取反规则与 `src/content/` 子树互不相交，无相互抵消。

**写盘正确性**：59 条 published 全落盘；`status: draft` 记录（含嵌套路径）零落盘；`规范文档/实战案例：PRD.md(路径偏置算法V2.0).md` 等嵌套路径保留；59 条 frontmatter + body 逐条 round-trip 精确相等（mismatch = 0）；注入的 3 类残留（散落 `.md`、嵌套残留目录、非 `.md` 文件）全被清掉；回读条数与拉取数不符 → exit 1；`../` 越界路径 → exit 1；重复执行字节级幂等。

**构建回归**：以 `git archive HEAD` 重建 HEAD 基线独立构建，与当前构建的 52 个预渲染 html 路径集合**完全相同**（仅 HEAD 有 = 空，仅当前有 = 空）；归一化 asset hash 与换行后产物树 0 个差异文件；`astro dev` 下 `/posts`、`/knowledge-base`、`/knowledge-base/ai使用技巧/ai评选`、`/wiki/concepts/mvvm架构`、`/wiki/index`、`/repos`、`/about` 全部 200 且有正文。`npx astro check` 与 HEAD 基线同为 10 errors / 93 hints，未新增。

**空内容必须响亮失败（F-1 修复，Main Agent 独立复核）**：`src/content` 整个移除且 LanceDB 不可达（`LANCEDB_URI=https://127.0.0.1:9/bogus` + 假 key）时，`npm run build` 于 `prebuild` 处以 exit 1 中止，`pack-skills`/`init-db`/`fetch-articles`/`astro build` 均未执行、`dist` 无新产物；六个集合目录存在但为空（0 个 `.md`）同样 exit 1，"目录在但为空"等同于无内容。Main Agent 复核结果一致：exit 1，错误信息含 `LANCEDB_URI`/`LANCEDB_API_KEY`/表行数提示，还原后 `src/content` 59 个文件。

**本地退避保留（AC-2，Main Agent 独立复核）**：盘上已有 59 个 `.md` 时用同一不可达 URI 跑 `npm run content:pull` → exit 0、恰好 3 行 `⚠️`、59 个文件 md5 清单前后逐字节一致。**正常路径（AC-3，Main Agent 独立复核）**：正常 `.env` 下连续两次拉取均 exit 0、各报 59 条、回读 3/15/29/5/5/2，两次 59 文件 md5 清单一致，且与改动前磁盘基线一致。

**Node flag**：`--experimental-strip-types` 带与不带在本机 v24.14.1 上 exit 0 且磁盘产物完全一致（59/59 md5 相同、无 ExperimentalWarning）。22.12–22.17 未实测（本机只有这一个 Node），推理链为：flag 自 22.6.0 引入、22.18.0 起转默认且该版本上仍接受 flag 为空操作，而 `engines` 下限 22.12.0，故 22.12–22.17 必需、≥22.18 无害。`scripts/content-pull.mjs` 是全仓唯一 import `.ts` 的脚本，`content-store.ts` 只含可擦除语法（type alias / interface / import type），普通 strip 即可。

## Known items

- **`fetched` 键随 frontmatter 落盘，已实证无害**。3 篇 posts 的 frontmatter 多出 `posts` schema 之外的 `fetched` 键（T1 迁入的抓取元数据）。zod `z.object` 默认剥离未定义键，实证为：当前 posts 页（带 `fetched`）与 HEAD 基线（不带 `fetched`）的渲染产物**字节相同**；全仓无任何 `{...frontmatter}` / `{...data}` 展开；`scripts/init-db.mjs:203` 只取 `data.title`、`src/lib/content.ts` 只取 `date/title/description`；唯一真正读它的 `src/lib/article-db.ts:195` 读的是表里的 JSON，不依赖磁盘文件。
- **`pack-skills.mjs` 在 Windows 上间歇性失败**：`UNKNOWN: unknown error, open 'public/skills-download\<zip>'`（errno -4094，`ERROR_SHARING_VIOLATION`）。与 T2 无因果——脚本未被 T2 改动，且脱离 content-pull 直接运行同样复现；每次栽在不同的 zip 上，独立重试 3/3 成功。只影响本机 Windows 的 `npm run build`，Linux CI 与 Vercel 不受影响。根治需给 `scripts/pack-skills.mjs` 加 EBUSY 重试，超出本任务 Allowed Scope，未立项。
- **vault 同步与两条 git 检查已空转（留给 T5）**。`.githooks/pre-commit:4` 与 `.githooks/pre-push:36` 判据的对象是 `src/content/knowledge-base` 的 git diff，内容出仓后该对象永久消失，两条检查恒为"无事发生"；`sync-kb:check` 因此成为一个永不失败的假绿门禁。行为后果需提前知道：**T5 落地前，从 vault 同步进来的任何内容都会被下一次 `content-pull` 清掉**——这是 `content` 表唯一真源的预期语义，但用户侧现象是"同步命令成功、站点没变"。
- **`getRelatedContent` 与 `getArticlesByStatus` 的双引号 bug 照旧**（`src/lib/article-db.ts:395`、`:402`、`:294`），每次构建日志打一条 400 后被 catch 吞掉。已立 [T6](2026-10-05-task-t6-fix-related-content--d9b0811d.md)。
- **Windows libuv 断言属失败路径噪音**：`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`，只在故意种入破坏性文件令 `astro build` 失败后出现，常伴 GBK 乱码。成功路径从未出现。Windows 上排查构建失败时看它上面那一行 Astro 错误，忽略这一行。
- **SSR 页面无静态产物可佐证**：`astro.config.mjs:7` 是 `output: "server"`，全仓只有 4 个文件声明 `export const prerender = true`（`posts/[slug].astro`、`wiki/[...slug].astro`、`skills/[slug].astro`、`knowledge-base/[...slug].astro`），3+29+5+15 = 52 与产物页数对应。`/about`、`/repos`、`/posts`、`/knowledge-base`、`/wiki/index` 与首页均为 SSR，`dist` 中没有它们的 html，这是既有渲染策略（详情页 prerender 保 SEO，列表聚合页走 SSR），不是回归。repos(5) 与 projects(2) 两个集合因而没有静态产物可佐证，其正确性依赖 content sync 的 schema 校验（`__probe__` 能炸掉整构建即是反证）与 dev 实测两条。
- **三个未追踪的 skill zip 待用户决定**：`public/skills-download/{engineeringX,noteX,proseX}.zip` 由 `pack-skills` 在构建中生成，其源 `.claude/skills/` 被 gitignore，zip 从未入库。是否收进公开仓未决。

## Execution

**首次派发被拦停**（worktree 基座不符）。Agent 的 worktree 隔离从 `origin/main` 拉分支，而 `origin/main` 停在 `0254971`、比本地 main 落后三个提交，该 worktree 内不存在 T1 的任何产物，也没有 `node_modules` 与 `.env`。coderX 判定验证项全部不可达成，未改任何文件、未动索引、未执行 `git rm --cached`，仅确认历史前提成立。改为主干共享工作树重派。**操作规则**：本地提交未推送前，worktree 隔离的基座永远是过期的 `origin/main`；凡依赖前序任务产物的派发，改用主干共享工作树并按派发适配器记录该事实。

**第二轮实现通过，评审提 F-1 后修复一次**。F-1 为降级分支允许静默空部署，修复方案由 Main Agent 裁定为不带新环境依赖的判据（`retained === 0` 才抛错），否掉了评审方首选的那个依赖 Vercel 面板设置 `LANCEDB_CLOUD_REQUIRED=true` 才生效的方案——缺了那一步修复在生产等于不存在。修复后 Main Agent 独立复核 AC-1/AC-2/AC-3 三组，全部通过。

## Dependencies

T1（[note://f6f78001-d086-47ba-b627-787ada391296/a7c1fab4-4118-443f-8de0-60c44714b875](2026-10-05-task-t1-content-store--a7c1fab4.md)）已落地并提交（HEAD `9b70beb`），`content` 表含 59 条 `status: published`。

## Allowed scope

`scripts/content-pull.mjs`、`package.json`、`.gitignore`、`.github/workflows/vector-sync.yml`
