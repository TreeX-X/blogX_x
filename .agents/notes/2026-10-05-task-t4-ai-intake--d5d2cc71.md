---
schema: harness-note/1
id: d5d2cc71-8987-47a2-870f-8c3c1e7f7e42
kind: task
lifecycle: implemented
created: 2026-10-05
class: feature
execution: completed
---

# T4 AI 上传处理通道

## Scope

**新增 `src/lib/article-intake.service.ts`（intake 通道的唯一实现）**：把 `scripts/fetch-articles.mjs` 中的 Readability 抓取、富媒体翻译（`buildTranslateInput`/`reassembleMarkdown`/`domToMarkdown`/`serializeNode`）、GLM 调用抽为服务端可导入的模块，并新增 GLM 结构化提取（`title`/`description`/`tags`/`date`/`originalAuthor`，JSON-only prompt + 容错解析）与发布链（schema 校验 → `setStatus(published)` → Deploy Hook）。三种输入（粘贴 URL / 上传文件 / 粘贴正文）汇成同一条流水线，产物只有一种：`collection: posts`、`status: draft` 的 `content` 表记录，含双语正文（`originalBody` = 原文，`translatedBody` = 译文）。CLI 与 dev 面板共用本模块，不各自实现抓取、翻译、校验或发布。

**两份翻译服务收敛为一份（结论）**：`src/lib/article-translation.service.ts` 全仓零 import（仅 `content-migrate.mjs` 与 `fetch-articles.mjs` import `.mjs`），属死重复，**已删除**；`.mjs` 成为全仓唯一翻译实现，`article-intake.service.ts` 从它 import `detectLanguage`/`translateText`。TS 侧的类型由 tsconfig 的 `allowJs: true` 从 `.mjs` 推断，`astro check` 无需额外声明文件即通过（本任务文件 0 error）。

**新增 `scripts/content-intake.mjs`**：`--url` / `--file` / `--text`（`--text -` 读 stdin）/ `--list` / `--dry-run` / `--json` / `--delete`；file/text 输入可加 `--source-url`。**新增 `scripts/content-publish.mjs`**：`--collection <key> --path <p> [--dry-run]`，先过 `content-schemas` 校验，通过则 `setStatus(published)` 并触发 `VERCEL_DEPLOY_HOOK`，失败则逐条列出字段错误且不改状态。新增 `src/pages/api/admin/intake.ts`（GET 草稿箱 / POST 三入口 / PUT 发布 / DELETE 丢弃）与 `src/pages/admin/posts.astro` 的三个入口、草稿箱、预览、发布/丢弃按钮；posts 列表给草稿打徽标。`package.json` 增加 `content:intake`、`content:publish` 两个入口并以 `"//"` 记录新环境变量名。

**`src/lib/content-schemas.ts` 的一行范围扩大（Main Agent 2026-10-05 授权）**：`import { z } from "astro:content"` → `import { z } from "astro/zod"`。二者是同一个 zod v4 实例——`astro:content` 虚拟模块本体（`node_modules/astro/templates/content/module.mjs:18`）就是 `export { z } from 'astro/zod';`，而 `astro/zod` 是 astro package.json exports 的公开子路径（→ `dist/zod.js` → `export * from "zod/v4"`）。动因是 CLI 侧的字段校验复用：`astro:content` 是 Astro 虚拟模块，Node ESM 直接抛 `ERR_UNSUPPORTED_ESM_URL_SCHEME (protocol 'astro:')`，于是一份"共用 schema"被锁死在 Astro 运行时里，比两份重复实现更隐蔽。改动后该模块 Astro 与 Node 通用，`content-migrate.mjs`、`fetch-articles.mjs` 现在**可以** import `content-schemas`，本次未改（超出 Allowed Scope），门已打开、留待后续。Main Agent 另核实：全仓剩余的 6 处 `astro:content` import（`content.config.ts` 的 `defineCollection`、`content.ts` 的 `getCollection`、四个详情页的 `render`）无一使用 `z`，全是只在 Astro 构建/渲染期存在的用法，没有共用件仍被锁死。

**草稿口径（Main Agent 裁定，T3 已记录）**：`content` 表记录的 `status` 字段是草稿的权威口径，`content-pull` 只写盘 `status: published`，所以草稿天然不进构建产物。frontmatter 里的 `isDraft` 是遗留物，由 glob loader 过滤，intake 一律写 `false`，不得与 `status` 混用。若两者出现冲突，以 `status` 为准。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-6、AC-7。

## Verification

以下为 2026-10-05 在本机（Windows 11，HEAD `22562e8`，LanceDB Cloud 真连）实跑结果。Main Agent 对其中条件 1 独立复跑过一次（退出码 127 → 0），结论一致。

**`astro/zod` 换掉 `astro:content` 后集合校验仍接通（本次范围扩大的唯一真实风险，已实证）**：往 `src/content/posts/` 临时写入 frontmatter 缺必填 `sourceUrl` 的探针，跑 `npx astro build`（不用 `npm run build`——其 prebuild 的 content-pull 会清空重建 `src/content`，探针会被冲掉）：

```
ASTRO BUILD EXIT: 127
[InvalidContentEntryDataError] posts → <probe> data does not match collection schema.
  sourceUrl: Required
  Location: E:\Tree Workspace\blogX_x\src\content\posts\<probe>.md:0:0
  Stack trace: at getEntryData (…/node_modules/astro/dist/content/utils.js:155:26)
```

字段校验仍然真的在拦坏数据，证明 Astro 内容运行时内部的 zod 与 `astro/zod` 是同一个实例。删除该文件后同一条命令复跑 exit 0、`Complete!`。反向证据：Node 侧 `import { collectionSchemas, validateCollectionFields } from './src/lib/content-schemas.ts'` 成功，7 个集合键齐全（posts、knowledgeBase、wiki、repos、skills、projects、toolbox），合法输入 `ok=true`，`{sourceUrl:'not-a-url'}` → `字段校验失败（posts）: sourceUrl: Invalid URL`。两边共用同一份定义，没有第二份。

**类型检查**：`npx astro check` 报 10 个 error，与本任务开始前逐文件一致（`src/lib/kv-messages.ts` 2、`src/pages/api/fun-messages.ts` 2、`src/pages/index.astro` 1、`src/scripts/nav-particles.ts` 5），本任务改动文件 0 error。hints 由 107 降到 49（`astro:content` 的 `z` deprecation 提示链消失），未引入新形态。

**URL 入口（真实可达 URL）**：`npm run content:intake -- --url https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html` → 草稿 `posts/using-claude-code-the-unreasonable-effectiveness-of-html-2`（撞已发布记录自动加 `-2`，在架文章未被覆盖），`status: draft`；`title`="Using Claude Code: The unreasonable effectiveness of HTML"、`date`=2026-05-20（meta `article:published_time`）、`description`=meta description、`originalAuthor`="Thariq Shihipar"、`tags` 空、`originalLang`=en；长度 `originalBody 18655 / translatedBody 15528 / body 15528`。

**草稿不进站点（AC-6 核心证据）**：`npm run content:pull` 写盘 59 条 published 并明确输出 `draft（不写盘）: 1`；`src/content/posts/` 仍为 3 个 `.md`，`…-html-2.md` 不存在。反向也验了：草稿发布变 published 后，下一次 `content-pull` 立刻把对应 `.md` 写盘（发布→进站点闭环成立）；而被校验拒绝的草稿始终不写盘。

**GLM 失败路径（两种形态）**：本机 GLM 真实返回 `HTTP 429: {"error":{"code":"1113","message":"余额不足或无可用资源包,请充值。"}}`；另把 `GLM_BASE_URL` 指向 `127.0.0.1:9` 制造网络失败。两种形态下草稿都照常落库、`intake.status: "failed"`、失败原因写进 frontmatter 的 `intake.warnings`，CLI 逐条 `⚠️ 需要人工修订` 打印，面板在 `#intakeNote` 显示同一批原因。译文失败没有被 `translateText` 的"失败返回原文"契约吞掉——同一性/占位标记检测给出"译文与原文逐字相同（GLM 未真正返回译文，失败被 translateText 静默吞掉）"。**设计约定：草稿允许带着失败原因存在，但消费者必须能分辨**——四个消费点（CLI 输出、面板提示、草稿箱状态列、`content-publish` 发布前警告）都读同一份 `intake.warnings`。

**`content-publish` CLI 两条路径都实跑**：非法草稿（`sourceUrl: "not-a-url"`）→ `❌ 字段校验失败，未发布（该记录状态未被改动）: - sourceUrl: Invalid URL`，exit 1，复读该记录仍为 `draft`；合法草稿 → `⚡ 已置为 published`、`⚠️ 未配置 Deploy Hook（VERCEL_DEPLOY_HOOK），内容已写入 content 表但站点不会自动重建…`、`✅ 已发布`，exit 0，未触发任何真实部署。

**dry-run 的两种形态**：`content-publish --dry-run` 校验与警告照常跑，但不改状态、不打 Hook、不碰表（复读记录仍为 `draft`）；`content-intake --dry-run` 把"如果写库会得到什么"整条打印（集合、path、status、`sourceUrl` 及占位警告、三条正文长度、全部 warnings），表里一条不多。措辞上 dry-run 只说"未写库/未改状态、未触发重建"，不同时出现"已写入"与"未改动"两种互相矛盾的表述。

**Deploy Hook（四种形态）**：变量缺失 → `triggered=false` + 原样警告；存在且 2xx → 本地假 hook 服务器收到一次 POST（body `{}`，日志只显示 host + 末 6 位，token 不外泄）；非 2xx → 抛错"Deploy Hook 调用失败: HTTP 500 …内容已置为 published 并写入 content 表，但站点未重建，请手动部署一次…"；不可达 → 抛错。全程未触发任何真实 Vercel 部署。

**文件入口与 dry-run**：`--file <md>` 继承 frontmatter 的 title/description/tags/author/date（`date` 由 YAML Date 对象正确规整为 ISO，过程中抓到并修掉一个真 bug：gray-matter 把 YAML 日期解析成 Date 对象而非字符串，原实现 `str(data.date)` 取空，导致日期被静默替换成"今天"）、全文入库、path 由标题派生。

**面板（dev，linkedom 载入 `/admin/posts` 真实 HTML、执行页面自带行内脚本、以真实 fetch 打 dev server，38 项断言全通过）**：三个入口的 DOM 与函数齐备；草稿箱直接看到 CLI 写入的草稿（两个入口读写同一批表内草稿，AC-6 的跨入口可见）；posts 列表给草稿打徽标；预览显示双语正文长度与 intake 失败原因；面板粘贴正文生成新草稿；发布走"校验 → published → Deploy Hook"并把 intake 失败记录与"站点不会自动重建"原样念给用户；丢弃能删掉 CLI 写的那条草稿。

**构建**：`npm run build` 退出码 0，日志以 `Complete!` 结束（首跑命中既有间歇性 `errno -4094` on `public/skills-download/auditX.zip`，重跑通过，与 T3 记录同一现象）。产物 `dist/client/posts/` 只有 3 个真实文章，草稿与 scratch 一律不在。

**数据面（报告前已复原）**：云表 62 条，分布 posts 3、knowledgeBase 15、wiki 29、repos 5、skills 5、projects 2、toolbox 3，0 条 draft、0 条 scratch；三条真实 posts 的 `originalBody/translatedBody/body` = 36036/14592/2204、16517/37961/37962、14160/6167/6365，与基线逐字一致；本地 `.lancedb` 的 `tableNames()` 为 `[]`。

**未运行 / 未覆盖**：未在真实浏览器里点击（用 linkedom 执行页面真实行内脚本 + 真实 fetch 驱动 dev server 代替）；未触发真实 Vercel 部署（按派工单要求以本地假 hook 服务器替代）。


## AC-7 裁定（独立评审结论，2026-10-05）

**AC-7 部分成立**：抓取 → GLM 提取 → 翻译 → 草稿 → 校验发布的全链机制已落地，并由 CLI 与面板共用同一份实现；失败路径已实证（GLM 429 时草稿保留，`intake.warnings` 逐条在 CLI 输出、面板提示、草稿箱状态列、发布前警告四处同源可见）。

**但 GLM 成功路径未验**：本机配额耗尽，全部 intake 走失败路径，"AI 提取的字段质量"与"真实双语正文"各零证据——观察到的 `title`/`description` 全部来自页面 meta 回落或正文截断，没有一条是 AI 提取的产物；`translatedBody` 与 `originalBody` 始终逐字相同或仅 HTML→Markdown 规整。

补齐判据（需在有额度的机器上执行，一次 `--url` 加一次 `--text`）：(a) `intake.status: "ok"` 且 warnings 为空；(b) `title`/`description`/`tags`/`date`/`originalAuthor` 非空且与正文相符，而非页面 meta 的照抄（可挑一篇 meta 缺失的页面来分辨）；(c) `translatedBody` 与 `originalBody` 长度差异合理，且确为另一语言（英文源应得中文译文）。三条齐备才可把 AC-7 判为成立。
## Dependencies

T3（[note://f6f78001-d086-47ba-b627-787ada391296/870946b7-1881-47c6-89ba-6083237cd47a](2026-10-05-task-t3-admin-to-cloud--870946b7.md)）已落地，管理写入走 `content-store`。T5（[note://f6f78001-d086-47ba-b627-787ada391296/d0a6d506-df77-4d90-b6f5-f8fb7144c726](2026-10-05-task-t5-cut-local-coupling--d0a6d506.md)）将把 `fetch-articles.mjs` 改为写 `content` 表并与 intake 共用写入口，届时脚本内那份抓取/富媒体翻译副本删除；它也可以顺手改成 import `content-schemas`（本次未动）。

## Allowed scope

`src/lib/article-intake.service.ts`（新增）、`src/lib/article-translation.service.ts`（删除）、`src/lib/article-translation.service.mjs`（改头部注释）、`scripts/content-intake.mjs`（新增）、`scripts/content-publish.mjs`（新增）、`src/pages/api/admin/intake.ts`（新增）、`src/pages/admin/posts.astro`、`package.json`。范围扩大（Main Agent 2026-10-05 授权）：`src/lib/content-schemas.ts` 一行 import 改动，理由与实证见 Verification 首段。另按派工单显式授权在 `.env` 追加 `VERCEL_DEPLOY_HOOK` 占位说明（该文件在 .gitignore 内，不入库）。

## Known items

- **AC-7 的 AI 提取质量半边未验证（本机 GLM 配额 429）**：本轮全部 intake 的 GLM 提取与翻译一次都没成功过，失败路径与兜底元数据链路已充分验证，"GLM 正常返回时 frontmatter 字段质量与双语正文的非同一性"是**未验证项**。GLM 配额恢复后须补一次正常路径复跑：一个真实 URL，核对提取出的 `title`/`description`/`tags`/`date`/`originalAuthor` 是否准确，以及 `originalBody`/`translatedBody` 确实不同且译文是译文。在补上之前，AC-7 只能判"机制已建、失败路径已验"。
- **`scripts/content-migrate.mjs` 与 `scripts/fetch-articles.mjs` 现在可以 import `content-schemas`，本次未改**（超出 Allowed Scope）。改动前这两份 node 脚本即使想复用同一份字段定义也做不到。门已打开，是否需要它们改走共享 schema 由后续任务决定（T5 本来就要动 fetch-articles）。
- **intake 产出的双语正文与面板的 `body` 编辑是两条独立通路**：`_helpers.saveEntry` 的合并规则会把 `originalBody`/`translatedBody` 从既有记录透传保留（面板表单从不提交它们），所以 intake 写的两条正文不会被一次面板保存抹掉；但面板也**不能**编辑正文——它的 `body` 是 Markdown 兜底内容，与详情页真正渲染的双语正文不是同一份数据。要不要让面板能编辑双语正文（以及草稿态下如何编辑），需要单独设计，本任务未做。
- **`fetch-articles.mjs` 仍持一份抓取与富媒体翻译副本**：该文件在本任务禁止修改清单内，故抽出采用"新服务持有实现、脚本暂留副本"的形态；两份代码当前同源同行为，但确有两份。T5 的 Scope 已明确让 fetch-articles 改为写 `content` 表并与 intake 同一写入口，届时脚本内副本删除、收敛为一份。
- **GLM 缺 key / 限流时的"伪译文"检测是启发式**：`translateText` 的契约是失败返回原文、缺 key 返回 `[中文翻译]`/`[English Translation]` 前缀占位。intake 用"译文与原文逐字相同"与"占位标记出现"两种信号判定失败；极端情形下确实无需改写的正文（纯数字、纯链接）会被误报为失败——误报只会多一条警告，不会产出错数据。
- **`intake.status: "failed"` 是警告而非发布门禁**：草稿带失败记录时 `content-publish` 会把它当众念一遍再照常发布（任务口径"GLM 失败时草稿保留并标注失败原因，可手工修订后再发布"）。若改成硬门禁，人工修订后 `intake.warnings` 仍在 frontmatter 里，草稿将永远无法发布。
- **file/text 输入没有外链时 `sourceUrl` 写 `urn:blogx-x:intake:<slug>` 占位**：postsSchema 的 `sourceUrl` 是必填 URL，而粘贴正文通常没有来源。占位过得了校验、也不会在站点上变成假外链，但面板/CLI 都会警告发布前补一个真实 URL。是否要给 intake 单独放宽这个必填项，需要改 schema，留给后续。
- **草稿 path 的兜底 slug 带正文指纹**（`post-<日期>-<8位sha1>`）：否则同一天粘贴两篇不同正文会落到同一个 `post-<日期>`，后一篇把前一篇草稿原地覆盖，第一篇的粘贴内容无声丢失（`resolvePath` 的同名草稿更新规则本为"重复提交同一份内容时刷新草稿"而设）。
- **任务书里"diff 预览"落地为内容预览**：草稿箱的"预览"展示提取出的 frontmatter 与双语正文长度/节选，没有做与既有内容的 diff（面板侧不存在可比较的基线，做 diff 会引入第二套比较语义）。

- **三条低 severity 观察（独立评审记录，均不构成返工）**：① `maskDeployHook` 只遮蔽 host，仍会露出 Deploy Hook token 的末 6 个字符——该 token 存在 gitignored 的 `.env`，日志却可能进入 Vercel 函数日志，建议改为只打 host；② Deploy Hook 不可达时抛的是裸 `TypeError: fetch failed`，没有非 2xx 那条带上下文的提示（"内容已置为 published 并写入 content 表，但站点未重建"），排查时不易判断内容到底进去没有；③ 面板草稿预览是元数据级（标题、来源、状态、三段正文长度、失败原因），看不到译文正文本身。
- **T5 合并 intake 与 `fetch-articles.mjs` 时的影响面已判定：对已有三篇零影响**。两份实现的唯一真实行为差异是 intake 对 `img` 的 `src` 做了 mdEscape（只涉及 `\`、`]`、`\n` 三个字符）而脚本没有。三篇 posts 落盘正文共 29 处图片引用与 4 处链接，**无一包含这三个字符**，合并后对这 33 个引用逐字节输出相同。只有将来抓到图片 URL 含 `]`/`\`/换行的文章，产物才会与旧脚本不同——而那种情况下旧脚本产出的是 malformed markdown（链接被提前闭合），所以该差异是修复而非风险。合并时在 note 记一句"img src 从此也会被转义"即可，不需要数据迁移或重跑已发布文章。
