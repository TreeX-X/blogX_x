import type { APIRoute } from "astro";
import { pingRedis } from "@/lib/kv-messages";
import { isAdminAuthConfigured, verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

export const prerender = false;

function isAuthed(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const sessionMatch = cookie.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
  return verifyAdminSession(sessionMatch?.[1] ?? null);
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthConfigured() || !isAuthed(request)) {
    return new Response(JSON.stringify({ error: "未授权" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await pingRedis();
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
};

