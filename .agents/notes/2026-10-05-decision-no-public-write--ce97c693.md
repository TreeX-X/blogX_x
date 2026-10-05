---
schema: harness-note/1
id: ce97c693-7007-4476-8d4c-e4f4d61e6181
kind: decision
lifecycle: proposed
created: 2026-10-05
class: architecture
---

# 决策：撤销公网写入面，管理入口为 CLI 与 dev-only 面板

## Context

`src/pages/api/admin/{posts,repos,projects,skills,toolbox,messages,ideas}.ts` 八个写接口没有鉴权且公网可达，任何人在线上均可改写站点内容。同日这些接口以 `writeFile` 写本地磁盘，在 Vercel serverless 上写入临时容器后即失效，线上的"保存"实际不产生任何持久效果。

## Decision

撤销公网写入面。`/admin` 与 `/api/admin/*` 在非 dev 环境一律返回 404，由 `src/middleware.ts` 单点拦截，不散落逐个 guard。管理入口为本地 CLI（`content-intake`、`content-publish`）与 `npm run dev` 下的面板；两者都经 `content-store` 写 LanceDB。`ADMIN_PASSWORD` 退出关键路径，仅作 dev 面板的可选门槛。

## Alternatives considered

维持公网面板并补鉴权（session + 登录限频）：保留远程管理能力，但把写入凭证与攻击面留在公网，与"内容凭密钥在机器上管理"的目标不符。

套 Vercel Deployment Protection 或 IP allowlist：仅在有手机或异地发布需求时才值得，当前需求不含远程管理。

公网面板 + 每机器独立密钥与操作审计：超出当前范围，且需要额外的签发与吊销机制。

## Consequences

发布前必须把仓库拉到本地，管理动作不再发生在浏览器里。站内不再承担公网登录态，`src/lib/admin-auth.ts` 的 session 逻辑保留但不负安全职责。写入凭证从"公网口令"变为"机器上的 `LANCEDB_*` 密钥"，与备份仓 PAT 一起只存在于 `.env`。

## Revisit signals

出现手机或异地发布需求；出现多人协作写入并要求区分操作来源。
