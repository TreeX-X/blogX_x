import type { APIRoute } from "astro";
import {
  ADMIN_SESSION_COOKIE,
  buildAdminCookieOptions,
  getAdminPassword,
  getAdminSessionToken,
  isAdminAuthConfigured,
} from "@/lib/admin-auth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthConfigured()) {
    return new Response(
      JSON.stringify({ error: "管理员认证未配置" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const password = typeof body.password === "string" ? body.password : "";
  const expectedPassword = getAdminPassword() || "";

  if (!expectedPassword || password !== expectedPassword) {
    return new Response(
      JSON.stringify({ error: "密码错误" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = getAdminSessionToken();
  if (!token) {
    return new Response(
      JSON.stringify({ error: "管理员认证未配置" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  const cookieOptions = buildAdminCookieOptions(request.url.startsWith("https://"));
  headers.append(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${token}; HttpOnly; Path=${cookieOptions.path}; Max-Age=${cookieOptions.maxAge}; SameSite=${cookieOptions.sameSite}${cookieOptions.secure ? "; Secure" : ""}`
  );

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};
