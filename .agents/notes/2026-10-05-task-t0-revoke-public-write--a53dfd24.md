---
schema: harness-note/1
id: a53dfd24-4a0a-4571-a964-93396c10d981
kind: task
lifecycle: implemented
created: 2026-10-05
class: architecture
execution: completed
---

# T0 撤销公网写入面

## Scope

新增 `src/middleware.ts`，对非 dev 环境（`import.meta.env.DEV` 为假）下路径为 `/admin`、`/admin/*`、`/api/admin/*` 的请求返回 404，`/api/admin/login` 与 `/api/admin/logout` 一并拦截。不修改任何 admin 页面、接口业务逻辑或 `src/lib/admin-auth.ts`。本任务只收敛暴露面，不改变本地 dev 行为。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-1。

## Verification

已在 2026-10-05 对生产构建产物完成实证（coderX 实施 + evaluatorX 独立评审）：

- `npx astro build` 退出码 0。生产产物 `.vercel/output/_functions/virtual_astro_middleware.mjs` 中 `import.meta.env.DEV` 已被静态替换，dev 分支整段从服务端包消除——拦截在生产里是无条件的，不依赖运行时标志。
- 直接驱动真实 Vercel serverless 产物 `.vercel/output/functions/_render.func/dist/server/entry.mjs` 的 `fetch()`：`/admin`、`/admin/`、`/admin/posts`、`/admin/nonexistent`、`/admin/a/b/c`、`/api/admin`、`/api/admin/`、`/api/admin/login`、`/api/admin/logout`、`/api/admin/{posts,repos,skills,toolbox,projects,ideas,messages,redis-health,nonexistent}` 在 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS 与同源 JSON body 下全部返回中间件 404，body 恒为 `Not Found`，`next()` 未被调用。
- 混淆路径 `//admin`、`//api/admin/login`、`/admin///ideas`、`/api//admin/posts`、`/./admin`、`/adm%69n`、`/%61dmin`、`/api/admi%6e/login`、`/admin?x=1`、`/api/admin/login?next=/x` 全部 404。不构成绕过的原因：Astro 构造 `RenderContext` 时先执行 `normalizeUrl()`（decodeURI + 斜杠坍塌），中间件拿到的 `context.url` 已是归一化结果。
- 误伤为零：`/administration`、`/administrators`、`/admin-panel`、`/adminx`、`/administer`、`/api/adminx`、`/api/admin-panel`、`/api/administrators`、`/api/admin-ops`、`/posts/my-admin-post`、`/wiki/admin`、`/api/ideas/admin`、`/_astro/*`、`/favicon.svg` 均不被中间件拦截。公开页 `/`、`/about`、`/posts`、`/repos`、`/skills`、`/toolbox`、`/knowledge-base` 与公开 API `/api/search`、`/api/ideas`、`/api/knowledge-graph`、`/api/fun-messages` 生产实测全部 200。
- dev（`astro dev`）实跑 30+ 请求，中间件误拦 0 次：9 个 admin 页面全部 200 并渲染真实 UI（`/admin/posts` 返回 101456 字节 HTML），`POST /api/admin/login` → 401、`GET /api/admin/redis-health` → 401，与改前一致。
- `npx astro check` 对 `src/middleware.ts` 0 诊断；仓库既有 10 处报错（`src/lib/kv-messages.ts` 2、`src/pages/api/fun-messages.ts` 2、`src/pages/index.astro` 1、`src/scripts/nav-particles.ts` 5）先于本任务存在，其中 9 处同源于 idea status 联合类型被收窄为 `"approved" | "rejected"`，与本改动无因果。

### 证据的边界（避免后人高估中间件的功劳）

端到端结论由两半证据合并而成，缺一不可。路由层一半：`.vercel/output/config.json` 中 `/admin*` 与 `/api/admin/*` 共 19 条路由 `dest` 全为 `_render`，唯一带 `status: 404` 的兜底路由 `dest` 仍是 `_render`，`.vercel/output/static` 无 admin 文件，故 admin 请求必进函数。函数层一半三条：被拦响应体与中间件源码的 `Response` 构造逐字节对应（Vercel 路由层与 Astro 自身 404 都产不出这个 content-type）；对照组 `/ADMIN`、`/admin%3f`、`/admin%25` 返回 Astro 的 HTML 404，证明同一请求路径上存在两种产出，中间件确在链上；直接调用生产编译产物 `virtual_astro_middleware.mjs` 的 `onRequest` 并以桩 `next()` 记录调用，被拦路径上 `nextCalled === false`。

评审 harness 直接调用 `handler.fetch()`，**绕过了 Vercel 路由层本身**。因此上表结论是"路由表送达 + 函数内短路"的合并结论。对 `/admin/nonexistent`、`/admin/a/b/c` 这类未匹配子路径，兜底路由自带 `status: 404`，即便没有本中间件也大概率返回 404——实测其 body 仍是中间件的纯文本，说明中间件先执行并短路，但这部分不应全部记在中间件名下。

## Known items（评审观察项，均不在本任务内处理）

- **跨站 POST 返回 403 而非 404**。Astro 6 内置 `createOriginCheckMiddleware()` 挂在 `pipeline.internalMiddleware`，先于用户中间件执行，因此 `Origin` 与 `url.origin` 不匹配的 POST 在到达本中间件之前已被挡为 403。这是全站 CSRF 防护，收紧它会削弱防护。同源 POST 已实证返回本中间件的 404，攻击者自行伪造 `Origin` 后同样被 404。AC-1 在此项上的准确表述为：任意写入形状的 admin 请求均不产生写入，同源 POST 返回 404。
- **`/api/ideas/admin` 仍在公开路由面内**。该路径生产实测返回 401（有 admin session 鉴权，不是未授权写入洞），但按需求 Goal"公开写入面为零"仍需处置。已作为跨任务集成项移交 T3，见该任务 Scope 末段。
- **被拦截与不存在的 404 形态可区分**。被拦路径返回纯文本 `Not Found`，未命中路径返回 Astro 的 HTML 404 页，理论上可探知 `/admin` 存在。`/admin` 的存在性在公开仓库 `src/pages/admin/` 中本就可读，判为可接受。
- **顺带发现（与本任务无因果，回归测试中观察到）**：在未提供 `x-forwarded-for` 的本地 harness 下，`POST /api/ai-search` 与 `POST /api/ideas` 返回 500 `ClientAddressNotAvailable`，堆栈落在 `next()` 之后的业务代码（`@astrojs/vercel` 对 `Astro.clientAddress` 的支持缺口）。生产环境 Vercel 会提供该头，故此现象**尚未确认是否为真实生产缺陷**；若线上 AI 搜索或留言提交异常，优先查此处。

## Dependencies

无。

## Allowed scope

`src/middleware.ts`
