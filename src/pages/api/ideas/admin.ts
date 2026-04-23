import type { APIRoute } from "astro";
import { getAllIdeas, reviewIdea } from "@/lib/kv-messages";
import { ADMIN_SESSION_COOKIE, verifyAdminSession, isAdminAuthConfigured } from "@/lib/admin-auth";

export const prerender = false;

// Verify admin token
function verifyAdmin(request: Request): boolean {
  const cookie = request.headers.get("cookie") || "";
  const sessionMatch = cookie.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
  return verifyAdminSession(sessionMatch?.[1] ?? null);
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthConfigured()) {
    return new Response(
      JSON.stringify({ error: "管理员认证未配置" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!verifyAdmin(request)) {
    return new Response(
      JSON.stringify({ error: "未授权" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const ideas = await getAllIdeas();

    return new Response(
      JSON.stringify({ ideas }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get all ideas error:", error);
    return new Response(
      JSON.stringify({ error: "获取点子列表失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthConfigured()) {
    return new Response(
      JSON.stringify({ error: "管理员认证未配置" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!verifyAdmin(request)) {
    return new Response(
      JSON.stringify({ error: "未授权" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const action = typeof body.action === "string" ? body.action : "";
    const implemented = typeof body.implemented === "boolean" ? body.implemented : false;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : undefined;

    if (!id || !action || !["approve", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "无效的请求参数" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await reviewIdea(id, action, implemented, adminNote);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: result.message
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Review idea error:", error);
    return new Response(
      JSON.stringify({ error: "审核失败，请稍后重试" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
