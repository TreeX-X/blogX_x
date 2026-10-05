---
schema: harness-note/1
id: 870946b7-1881-47c6-89ba-6083237cd47a
kind: task
lifecycle: proposed
created: 2026-10-05
class: architecture
execution: pending
---

# T3 管理入口上云

## Scope

**五个落盘写接口改为写 `content` 表**：`src/pages/api/admin/{posts,repos,projects,skills,toolbox}.ts` 删除 `node:fs/promises` 的 `writeFile`/`unlink`/`mkdir`/`readdir`/`cp` 与本地目录操作，写方法改调 `content-store.upsertEntry`/`deleteEntry`；`GET` 改读 `content-store.listCollection`，面板反映表的实时状态而非上次 pull 到磁盘的副本；`DELETE` 先用 `getEntry` 读出记录，把实际删除内容放进响应体。四份手写的正则 frontmatter 解析（`parseFrontmatter`/`toFrontmatter`）全部删除，字段校验走 `content-schemas` 的 zod schema。`skills.ts` 的整目录 `cp` 到 `public/skills-download/` 删除（zip 仍由 prebuild 的 `pack-skills.mjs` 从 `.claude/skills/` 生成）；从本地路径导入 SKILL.md 的只读能力保留，改用 `gray-matter` 解析（仓库既有序列化器）。`messages.ts`、`ideas.ts` 走 Redis，未改动。

**新增 knowledgeBase 与 wiki 管理面**：`src/pages/api/admin/knowledge-base.ts`、`wiki.ts` 与 `src/pages/admin/knowledge-base.astro`、`wiki.astro`。身份字段是集合内嵌套路径（`AI使用技巧/AI评选`、`规范文档/实战案例：PRD.md(路径偏置算法V2.0)`），支持新增（`POST`）、原地编辑（`PUT` 不带 `from`）、移动与重命名（`PUT` 带 `from`，先写目标后删源）。路径校验拒绝 `..`、绝对/盘符路径、反斜杠与 Windows 非法字符，因此带全角冒号、圆括号、空格、文件名内 `.md` 的既有 44 条路径仍全部可用（另有一次非改写验证，见 Verification）。目标路径已被占用时返回 409，不静默覆盖。

**toolbox 迁为内容集合**：新增 `toolbox` schema 与集合键（存入 `content` 表，`collection: "toolbox"`，path 为 slug），字段 `name`/`url`/`category`/`summary`/`icon?`。`src/lib/toolbox.ts` 保留 `getToolboxIconUrl`/`groupToolboxItems`/`searchToolboxItems` 三个导出符号并仍是纯函数，数据改由新增的 `getToolboxItems()` 从 `content-store` 读——面板写入即时可见，`toolbox/index.astro` 与 `ai-search.ts` 只做了取数与传参的最小改动。原 `admin/toolbox.ts` 序列化模板里内嵌的第二份 `ToolboxItem` 接口与数组字面量（靠字符串拼出整个 `src/lib/toolbox.ts`）随之消失。既有 3 条工具（JSONLint、Regex101、色彩选取er）已入表：`jsonlint`、`regex101`、`色彩选取er`，slug 由名称按"小写 + 空白折叠连字符 + 丢弃符号"派生。

**`/api/ideas/admin` 的处置（T0 评审移交项，已闭环）**：选择"纳入中间件阻止前缀"。该路径不在 `/admin`、`/api/admin` 前缀内，却在生产公网可达；它带 admin session 鉴权（无 session 时 401，不是未授权写入洞），但需求 Goal 要求公开写入面为零，而[撤销公网写入面的决策](2026-10-05-decision-no-public-write--ce97c693.md)明确否掉了"公网面板 + 口令鉴权"这一形态——留着它等于把一条带凭证的写入面留在公网，与"管理入口为 CLI 与 dev-only 面板"的决策正面冲突。因此 `src/middleware.ts` 的 `BLOCKED_PREFIXES` 增加 `/api/ideas/admin` 一项：它只拦 admin 子段，不影响同一前缀下的公开读接口 `/api/ideas`（POST 提交与 GET 读取仍是公开的）。管理面板页 `/admin/ideas` 本就在 `/admin` 前缀内，生产不可达；所以生产里没有任何调用方需要这个接口。改为受控入口（例如搬去 `/api/admin/ideas`）要同时改 `src/pages/admin/ideas.astro`，超出本任务 Allowed Scope，未采纳。

**跨模块公共层**：新增 `src/pages/api/admin/_helpers.ts`（下划线前缀，Astro 路由不收录）。七个接口共用 JSON 响应、路径校验、schema 校验、读改写四条薄封装；不建 LanceDB 连接、不解析 frontmatter、不写盘，读写一律经 `content-store`。

**范围扩大（Main Agent 2026-10-05 授权）**：T3 主体落地后补了两处邻接缺口，否则交付不完整——新页面没有导航入口等于不存在，老页保存失败无提示等于静默丢数据。

1. 「知识库」「Wiki」入口加到**全部 10 个** admin 页面（`index`、`posts`、`repos`、`projects`、`skills`、`messages`、`ideas` 原有侧栏各有一份拷贝，逐一补上；`toolbox`、`knowledge-base`、`wiki` 在本任务主体中新建时已含）；仪表盘 `sections` 数组补两项，计数加载的 `apis` 映射同步补 `knowledge-base` 与 `wiki`。
2. `posts.astro`、`repos.astro`、`projects.astro`、`skills.astro` 的保存函数改为检查响应码与错误体，失败时在表单内显示接口返回的具体原因（错误位在 `toggleForm` 时清空）；`skills.astro` 的「Slug 不能为空」由 `alert()` 改为同一错误位。`messages.astro`、`ideas.astro` 有同样的静默失败模式（`await fetch` 后直接 `load()`），一并修掉：表级操作失败显示在表格下方的 `#actionError`，`ideas` 的 `review`/`deleteIdea` 共用该错误位。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-5（posts、knowledgeBase、wiki、repos、projects、skills、toolbox 七个集合可从 dev 面板或 CLI 增改删）。CLI 侧本任务未新增：`content-intake` 与 `content-publish` 属 T4 范围，本任务落地时二者尚不存在，没有可沿用的链路——AC-5 的 CLI 半边要等 T4 才闭合，此前只有 dev 面板一条路径。AC-6（草稿态）不在本任务范围：面板只写 `status: published`，无草稿 UI。

## Verification

以下为 2026-10-05 在本机（Windows 11，HEAD `54ac0f7`）实跑结果。

**类型检查**：`npx astro check` 报 10 个 error，与本任务开始前完全一致（`src/lib/kv-messages.ts` 2、`src/pages/api/fun-messages.ts` 2、`src/pages/index.astro` 1、`src/scripts/nav-particles.ts` 5），本任务改动文件 0 error。新增 warning 只有一类：三个 admin 页面的 `editItem`/`deleteItem` "declared but never read"——它们由行内 `onclick` 调用，`posts.astro`/`repos.astro`/`messages.astro` 等既有页面同样如此，属仓库既有形态。`content-schemas.ts` 的 `z` deprecation warning 数量随新增一个 schema 从 51 条增至 58 条，未引入新形态。

**构建**：`npm run build` 退出码 0，日志以 `Complete!` 结束；prebuild 的 `content-pull` 拉取 posts 3、knowledgeBase 15、wiki 29、repos 5、skills 5、projects 2，合计 59 条 published、0 条 draft。`pack-skills` 首跑命中本机既有的间歇性 `errno -4094`（打开 `public/skills-download/auditX.zip` 失败），重跑通过。`fetch-articles --translate` 阶段 GLM 返回 429「余额不足或无可用资源包」，为既有环境状态，构建链自身容错，不影响本任务结论。

**dev 环境逐类验证**（`npm run dev -- --port 4402`，content-store 连 LanceDB Cloud）：一次性脚本驱动真实 HTTP，61 项断言全部通过。过程中该脚本抓到两个本任务自己引入的缺陷并已修复：原地编辑一度被 rename 的冲突检查 409 掉；不带 `body` 的 PUT 会把整篇正文抹空。修复后重跑即为下述结果。

- 七个集合各建一条 scratch 记录 → `GET` 立即可见（posts→4、repos→6、projects→3、skills→6、toolbox→4），随后删除；结束时 posts 3、repos 5、projects 2、skills 5、knowledgeBase 15、wiki 29、toolbox 3，无残留。
- `knowledgeBase`：嵌套路径 `T3探针/子目录 甲：括号(含.md字样)`（含中文、空格、全角冒号、圆括号、文件名内 `.md`）新建成功；外来键 `source` 与 `body` 在只改 `title` 的原地 PUT 后原样保留；`PUT {path, from}` 完成搬家，源记录消失且 `source`/`body` 跟着走；`../逃逸`、`C:\x`、`a/b.md`、`a/..`、`a//b`、`a:b`、`a<b`、纯空白 共 8 种非法路径全部 400，`tags` 传错类型 400；新建撞已有路径 409、搬到已有路径 409。
- 存量 44 条 KB/wiki 记录（15 + 29）的字段值被逐条搬到 scratch 路径上过 schema 校验，0 条失败——现存内容没有一条会因为字段校验而无法再编辑。44 条既有嵌套路径本身另做了一次非改写验证：对每条既有路径发 `POST`，44/44 返回 409（路径合法但已存在）而非 400，即校验规则与 Obsidian 喂进来的路径形状完全相容。
- `toolbox`：3 条既有工具在表（`jsonlint`、`regex101`、`色彩选取er`）；同名重复 POST 409、`url: "not-a-url"` 400；`/toolbox` 页渲染 3 张卡、`共 3 个工具`、`开发工具`/`在线工具` 两组、无图标条目走 favicon 兜底（3 处）；AI 搜 `scope=toolbox` 查询 "json" 命中 JSONLint、"正则" 命中 Regex101、"颜色" 命中色彩选取er，结果结构与改前一致。
- 公开页 `/`、`/posts`、`/knowledge-base`、`/wiki/index`、`/toolbox`、`/repos`、`/skills` 与 KB 嵌套详情页 `/knowledge-base/辊刀软件-知识库/算法` 全部 200；`/api/ideas` 200 未被误伤；三个 admin 面板页 200。

**生产产物**：对最终 `npx astro build` 产出的 `.vercel/output/functions/_render.func/dist/server/entry.mjs` 直接发起 `fetch()`（同源 JSON body）：`GET`/`POST /api/ideas/admin` 均返回 404、`text/plain`、body 9 字节（`Not Found`，即中间件响应，与 T0 记录的形态一致）；`GET`/`POST /api/admin/posts`、`GET`/`PUT /api/admin/knowledge-base`、`GET /api/admin/wiki`、`GET /api/admin/toolbox`、`GET /admin`、`GET /admin/wiki` 同样 404；公开 `/api/ideas` 仍 200 JSON，`/posts` 200；`/toolbox` 200 且含 `共 3 个工具`、JSONLint 与 3 处 favicon。

**未运行 / 未覆盖**：未安排 evaluatorX 独立评审；未在真实浏览器里点击（页面行为用 linkedom 载入真实 HTML、执行页面自带的行内脚本、以真实 fetch 打 dev server 来驱动，见下节）；未制造一次真实的 LanceDB 不可达来观察降级（只在代码层确认 `listCollection` 失败返空数组 → 面板与 `/toolbox` 走空态，不抛异常）。

## 范围扩大后的页面级验证

授权范围内新增的 7 个老页面改动完成后，`npx astro check` 复跑：仍是原有 10 个 error，本任务文件 0 error（warning 仍只有既有的"行内 onclick 调用的函数未被读取"一类）。`npm run dev -- --port 4404` 下以 linkedom 载入每个 admin 页的真实 HTML、执行页面自带行内脚本、用真实 fetch 打 dev server，28 项断言全通过：

- 10 个 admin 页面（`/admin`、`/admin/{posts,repos,projects,skills,toolbox,messages,ideas}`、`/admin/knowledge-base`、`/admin/wiki`）的侧栏**全部**含 `href="/admin/knowledge-base"` 与 `href="/admin/wiki"`，且两个目标页均可进入（200）。
- 仪表盘 HTML 含 `data-section="knowledge-base"`/`data-section="wiki"` 两张卡片及描述文案。
- 四个老页的保存路径实跑：`posts`/`repos`/`projects` 填入非法 URL 后调用页面自身的 `saveX()`，`#formError` 分别显示 `字段校验失败（posts）: sourceUrl: Invalid URL`、`（repos）/（projects）: repoUrl: Invalid URL`，且集合条数不变（3→3、5→5、2→2）——拒绝不再静默；`skills` 表单构造不出 schema 违反（三个必填项都是普通字符串），其可达失败是空 slug 的客户端校验，实测显示 `Slug 不能为空` 且未写入（5→5）。四页随后的合法保存全部成功、错误位被清空，scratch 记录当场删除。
- `messages` 对不存在的 id 调 `setStatus`、`ideas` 对不存在的 id 调 `deleteIdea`，`#actionError` 分别显示 `操作失败（HTTP 400）`（不再静默）。

生产行为复验（扩大范围后的最终 `npm run build` 产物，26 个探针直驱 `.vercel/output/functions/_render.func/dist/server/entry.mjs`）：22 项写入面全部 404 `text/plain` `Not Found`（`/api/ideas/admin` GET+POST、`/api/admin/{posts,repos,projects,skills,toolbox,knowledge-base,wiki,messages,ideas}` 的 GET/PUT/DELETE/POST、`/admin` 与四个 admin 子页），放行 4 项公开面（`/api/ideas` 200 JSON、`/toolbox` 200 且含三个工具、`/posts` 200；`/knowledge-base/辊刀软件-知识库/算法` 在函数层返回 404 是 harness 绕过 Vercel 静态路由所致，`.vercel/output/static/knowledge-base/辊刀软件-知识库/算法/` 产物在盘上）。

## 数据面修复后的验证（Attempt 2，2026-10-05）

独立评审在功能面全绿之外抓出两条数据面 BLOCKER，均为本任务引入的回归，均已修复并复测。

**F1 面板保存 posts 曾抹掉双语正文**：`_helpers.ts` 的 `saveEntry` 把 `originalBody`/`translatedBody` 写死为空串，而 `upsertEntry` 是 delete + add 的整行替换，于是一次面板保存即令长文正文归零，页面转去渲染 `body`（短版译文而非原文）。T3 之前面板只写 `src/content/posts/*.md`、从不碰表，故这是本任务引入的回归。修为从 `existing` 透传这两个字段，并在 `_helpers.ts` 补一段逐字段审计注释，把 `saveEntry` 构造的记录的 8 个字段（collection / path / frontmatter / body / originalBody / translatedBody / status / updatedAt）逐个标注"保留既有值"或"有意重置为新值"及其来源——该漏洞的成因就是造了一条记录却没意识到它在替换整行。验证：scratch posts 记录带两个非空正文，经面板式 PUT 三次保存后两字段逐字保留、`body` 按提交更新且缺键保留、`title`/`status`/passthrough 键 `originalLang` 均正确；对真实记录 `anthropic-harness-design-long-running-apps` 做一次 GET 结果原样 PUT 往返，保存后 `originalBody`/`translatedBody`/`body` = 36036/14592/2204 字符，与保存前逐字一致（仅 `updatedAt` 变动）。

**F2 降级时面板写入曾静默落到本地库并返回成功**：`getDb()` 缺凭据时降级本地，而 `openContentTable` 表不存在返 null、`ensureContentTable` 却会建表——"表不存在"在读路径是空态、在写路径是"可建"，于是 `upsertEntry` 不抛错。评审方新起 dev server 后连发 44 次保存，全部返回 200，本地 `.lancedb` 多出一张 44 行的 `content` 表。修为两层：根因层 `content-store` 自载 dotenv；纵深层写路径降级即拒。

纵深层的判据是"先建连再判据"：`assertWritable` 为 async，内部先 `await getDb()` 再读 `dbDegraded`。第一版写成同步函数、在取表之前判据，而连接是惰性的（`dbInstance` 缓存），进程内**第一次调用若是写入**时还没连过任何库、`dbDegraded` 仍是初始的 false，断言直接放行——恰是要防的场景。该缺陷由降级探针当场抓出（输出 `upsertEntry: NO ERROR (BAD)`、本地 `hasContentTable: true`、`listCollection: 1 rows`），改为 async 后复测通过。

纵深层最终证据（子进程置空凭据、cwd 仓库根，`[BEFORE]`/`[AFTER]` 由探针直连本地库读 `tableNames()` 得出）：`upsertEntry`/`deleteEntry`/`setStatus` 三者均抛 `拒绝写入——LANCEDB_URI / LANCEDB_API_KEY 凭据缺失或 LanceDB Cloud 连接失败，当前连接已降级到本地库（.lancedb）`；`[AFTER] dirEntries=[] tableNames=[] hasContentTable=false`，本地库连目录里都没有文件——断言先于 `ensureContentTable()`，本地库根本没被碰过。同一运行内读路径保持容错：`listCollection("posts") → 0 rows`、`getEntry → null`。第二个变体（凭据存在但云端不可达，走 connect 失败分支）三个写操作抛同样的拒绝，`[AFTER] hasContentTable=false`，两个分支都堵住。

数据面回归（Main Agent 独立复核）：云表 62 条，分布 posts 3、knowledgeBase 15、wiki 29、repos 5、skills 5、projects 2、toolbox 3；三条真实 posts 的 `originalBody`/`translatedBody`/`body` 分别 36036/14592/2204、16517/37961/37962、14160/6167/6365，与 T1 迁移时逐字段一致；scratch 残留 0；本地 `.lancedb` 的 `tableNames()` 为空。
## Known items

- **`content.config.ts` 没有登记 `toolbox` astro 集合**，与派工单"新增 `toolbox` 集合时两处都要加"的表述不同。核对后确认只需要一处：`content-store` 的 `CollectionKey` 来自 `content-schemas`，而 `content.config.ts` 的集合是给 glob loader 用的。`toolbox` 不经 glob（数据由 `src/lib/toolbox.ts` 直读 `content` 表，否则面板写入要等 content-pull 落盘才生效），登记它只会得到一个永远为空、且 base 目录无人生成的集合。若要改走 glob 路径，必须同时改 `scripts/content-pull.mjs` 的 `COLLECTIONS`（硬编码六项，该文件在本任务禁止修改清单内）——是否要这条路由，留给 Main Agent 决策。
- **`scripts/content-pull.mjs` 的 `COLLECTIONS` 不含 `toolbox`**：硬编码目录表，不从 content.config 推导。toolbox 不经磁盘，所以功能不受影响；但 `src/content/toolbox/` 永远不会被生成，任何期望它存在的下游会踩空。
- **侧栏与错误提示曾两处缺口，已按授权补齐（2026-10-05）**：最初只重写了 `toolbox.astro` 与两个新页面，另外七个 admin 页的侧栏没有「知识库」「Wiki」，四个老页的保存函数也不看响应码。Main Agent 授权扩大 Allowed Scope 后已全部补齐（见 Scope 末段与页面级验证），此处保留记录以防再犯——admin 侧栏是每页一份拷贝，新增页面必须同步改全部副本，下一个新增集合仍会踩到。
- **运行时读库必须先加载 `.env`（根因已修，两处止血已收掉）**：`content-store` 只从 `process.env` 读凭据，而 astro dev / serverless 的 server 上下文不把 `.env` 注入 `process.env`（只进 `import.meta.env`）。任何运行时读库入口忘了加载 dotenv 就会静默降级到本地 `.lancedb`——面板会显示"没有内容"而不是报错，写入更糟：会落进本地库却返回成功。首次实测发生在 T3 首轮：面板读到本地空库而非云端 62 条，脚本把 3 条 toolbox 与 scratch 写进了本地库（云端未被污染，本地表已丢弃，云端 62 条与 scratch 0 残留经 Main Agent 复核）。修复分两层落在 `src/lib/content-store.ts`：模块顶部 `dotenv.config()`（凭据的唯一读者，加载一次覆盖全部调用方；Vercel 上没有 `.env` 文件，此行是无操作且不覆盖已存在的键），以及写路径降级即拒（见 Verification 的修复段）。`src/pages/api/admin/_helpers.ts` 与 `src/lib/toolbox.ts` 顶部原有的两处 `dotenv.config()` 已删除，`_helpers.ts` 留一行模块头说明防止再加回来。后续任何新增的运行时读库入口不需要再自行加载 dotenv。
- **编辑语义**：`PUT` 在既有 frontmatter 与正文上合并——未提交的键（`posts.fetched`、`knowledgeBase.source`、历史 `date`）保留，显式提交 `""` 才算清空，日期输入留空即保留原值；搬家时合并基线是 `from` 而不是目标 path（源记录的键与正文跟着走）。这是为了一次普通编辑不抹掉同步链路写进来的元数据（`article-db` 读 `fetchedAt`/`contentHash`/`translatedAt`）。副作用是面板无法清空不在表单里的字段。
- **dev 下 KB/wiki 详情页对含大写拉丁字符的嵌套路径 404**（如 `/knowledge-base/AI使用技巧/AI评选`）：astro dev 的 getStaticPaths 查找大小写敏感而路由名被小写化。生产构建产物落盘为小写路径，线上可用；页面与内容链路本任务未改，判定为既有 dev-only 现象，非本任务因果。
- **写入耗时**：LanceDB Cloud 的单条 upsert 实测 2–7 秒（`ensureContentTable` 的 `tableNames()` + `delete` + `add` 三次往返），KB/wiki 列表页首屏与批量导入都会明显变慢。单表全量 scan 的读取路径（`listCollection`）随条目数线性变慢。
- **`isDraft` 与 `status` 两套草稿口径并存（Main Agent 裁定，T4 依此实现）**：`content` 表记录的 `status` 字段是草稿的**权威口径**——`content-pull` 只写盘 `status: published` 的记录，所以草稿天然不进构建产物。frontmatter 里的 `isDraft` 是遗留物，由 glob loader 过滤；面板与后续 intake 一律写 `false`，不得与 `status` 混用。两者若冲突，以 `status` 为准。AC-6 的草稿态实现走 `status: draft`。

## Dependencies

T2（[note://f6f78001-d086-47ba-b627-787ada391296/3680cc06-8960-4265-acb5-861ea4d931ae](2026-10-05-task-t2-build-chain--3680cc06.md)）已落地，`content-pull` 可用（本任务未改动）。`src/lib/content-store.ts`、`src/lib/content-schemas.ts` 的既有契约按只读使用。

## Allowed scope

主体改动：`src/pages/api/admin/{posts,repos,projects,skills,toolbox}.ts`、`src/pages/api/ai-search.ts`、`src/pages/admin/toolbox.astro`、`src/pages/toolbox/index.astro`、`src/lib/toolbox.ts`、`src/lib/content-schemas.ts`、`src/middleware.ts`。

主体新增：`src/pages/api/admin/_helpers.ts`、`src/pages/api/admin/knowledge-base.ts`、`src/pages/api/admin/wiki.ts`、`src/pages/admin/knowledge-base.astro`、`src/pages/admin/wiki.astro`。五个新文件都在派工单给出的 `src/pages/api/admin/*.ts` 与两个 admin 页面路径之内；`_helpers.ts` 用下划线前缀，Astro 路由不收录它。

范围扩大（Main Agent 2026-10-05 授权）：`src/pages/admin/{index,posts,repos,projects,skills,messages,ideas}.astro` —— 侧栏补「知识库」「Wiki」入口，四个集合页另加保存失败的错误展示，`messages`/`ideas` 修掉同样的静默失败。

Attempt 2 修复的范围（Main Agent 临时解禁）：`src/lib/content-store.ts` 与 `src/pages/api/admin/_helpers.ts`。`content-store.ts` 在原派工单的禁止清单内，因 F2 的根因（凭据唯一读者不自载 dotenv）与纵深防线（写路径降级即拒）都只能落在该文件里，经 Main Agent 裁决解禁，仅限本修复所需改动，不得借机重构其他部分。两处原止血（`_helpers.ts` 与 `lib/toolbox.ts` 顶部的 dotenv.config）已随之删除。
