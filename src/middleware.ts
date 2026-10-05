import { defineMiddleware } from "astro/middleware";

// Note: 撤销公网写入面——非 dev 环境 /admin 与 /api/admin 一律 404 — see .agents/notes/2026-10-05-task-t0-revoke-public-write--a53dfd24.md
// Note: /api/ideas/admin 一并 404——意见箱审核接口不在 /api/admin 前缀内，却是同一条写入面 — see .agents/notes/2026-10-05-task-t3-admin-to-cloud--870946b7.md

const BLOCKED_PREFIXES = [
  "/admin",
  "/api/admin",
  /*-- 路径与公开读接口 /api/ideas 不同（后者同路径没有 admin 子段），拦 admin 子段不误伤公开读写 --*/
  "/api/ideas/admin",
];

const isAdminPath = (pathname: string): boolean =>
  BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export const onRequest = defineMiddleware(async (context, next) => {
  if (import.meta.env.DEV) {
    return next();
  }

  if (isAdminPath(context.url.pathname)) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return next();
});
