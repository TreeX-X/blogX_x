import type { APIRoute } from "astro";
import { ADMIN_SESSION_COOKIE, buildAdminCookieOptions } from "@/lib/admin-auth";

export const prerender = false;

export const POST: APIRoute = async () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  const cookieOptions = buildAdminCookieOptions(false);
  headers.append(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=${cookieOptions.path}; Max-Age=0; SameSite=${cookieOptions.sameSite}`
  );

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};
