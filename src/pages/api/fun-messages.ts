import type { APIRoute } from "astro";
import { submitFunMessage, auditContent, processFunMessages } from "@/lib/kv-messages";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const ip = clientAddress || "unknown";

    // Validation
    if (!name || name.length < 2 || name.length > 20) {
      return new Response(
        JSON.stringify({ error: "昵称长度必须在2-20个字符之间" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!content || content.length < 5 || content.length > 200) {
      return new Response(
        JSON.stringify({ error: "留言内容必须在5-200个字符之间" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Process pending messages first
    await processFunMessages();

    // Submit message
    const result = await submitFunMessage(name, content, ip);

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
        messageId: result.messageId
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fun message submission error:", error);
    return new Response(
      JSON.stringify({ error: "提交失败，请稍后重试" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const GET: APIRoute = async () => {
  try {
    // Process pending messages before returning approved ones
    await processFunMessages();

    const { getApprovedFunMessages } = await import("@/lib/kv-messages");
    const messages = await getApprovedFunMessages();

    return new Response(
      JSON.stringify({ messages }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get fun messages error:", error);
    return new Response(
      JSON.stringify({ error: "获取留言失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
