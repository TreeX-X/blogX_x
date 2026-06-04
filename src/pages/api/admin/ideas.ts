import type { APIRoute } from "astro";
import { getAllIdeas, reviewIdea, deleteIdea } from "@/lib/kv-messages";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const ideas = await getAllIdeas();
    return new Response(JSON.stringify(ideas), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin get ideas error:", error);
    return new Response(JSON.stringify({ error: "获取点子失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const { id, action, implemented, adminNote } = await request.json();
    if (!id || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "参数无效" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const result = await reviewIdea(id, action, implemented ?? false, adminNote);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin review idea error:", error);
    return new Response(JSON.stringify({ error: "操作失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const { id } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: "缺少 id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const result = await deleteIdea(id);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin delete idea error:", error);
    return new Response(JSON.stringify({ error: "删除失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
