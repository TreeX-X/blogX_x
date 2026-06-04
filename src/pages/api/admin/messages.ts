import type { APIRoute } from "astro";
import { getAllFunMessages, updateFunMessageStatus, deleteFunMessage } from "@/lib/kv-messages";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const messages = await getAllFunMessages();
    return new Response(JSON.stringify(messages), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin get messages error:", error);
    return new Response(JSON.stringify({ error: "获取留言失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const { id, status } = await request.json();
    if (!id || !["approved", "rejected"].includes(status)) {
      return new Response(JSON.stringify({ error: "参数无效" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const result = await updateFunMessageStatus(id, status);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin update message error:", error);
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
    const result = await deleteFunMessage(id);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin delete message error:", error);
    return new Response(JSON.stringify({ error: "删除失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
