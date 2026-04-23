import type { APIRoute } from "astro";
import { submitIdea } from "@/lib/kv-messages";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const idea = typeof body.idea === "string" ? body.idea.trim() : "";
    const ip = clientAddress || "unknown";

    // Validation
    if (!name || name.length < 2 || name.length > 20) {
      return new Response(
        JSON.stringify({ error: "昵称长度必须在2-20个字符之间" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!idea || idea.length < 5 || idea.length > 500) {
      return new Response(
        JSON.stringify({ error: "点子内容必须在5-500个字符之间" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Submit idea
    const result = await submitIdea(name, idea, ip);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.message }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: result.message,
        ideaId: result.ideaId
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Idea submission error:", error);
    return new Response(
      JSON.stringify({ error: "提交失败，请稍后重试" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const GET: APIRoute = async () => {
  try {
    const { getApprovedIdeas } = await import("@/lib/kv-messages");
    const ideas = await getApprovedIdeas();

    return new Response(
      JSON.stringify(ideas),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get ideas error:", error);
    return new Response(
      JSON.stringify({ error: "获取点子失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
