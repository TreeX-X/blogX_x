/**
 * 站内图片代理：GET /api/media?u=<https-url> → 服务端取回媒体后同站输出。
 *
 * 为什么需要：部分源站（如 claude.dev）对图片响应带 Cross-Origin-Resource-Policy:
 * same-origin，浏览器以 ERR_BLOCKED_BY_RESPONSE.NotSameOrigin 拒绝跨站嵌入——即使把
 * 相对路径绝对化也显示不出来。文章正文里的媒体 URL 在 intake 期统一改写为本代理路径，
 * 由服务端取回再从自己站点输出，绕开 CORP，也顺带不再依赖源站防盗链策略。
 *
 * 边界：只代理 https、只回 image/*；私网/回环主机名拒绝（防 SSRF）。缓存一年——
 * 入库时 URL 已定格，内容可视为不可变。
 */
import type { APIRoute } from "astro";

export const prerender = false;

const UPSTREAM_TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0 (compatible; BlogX_x/1.0; +https://blogx-x.vercel.app)";

/** 回环 / 私网主机名一律拒绝：代理只面向公网媒体源 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(127\.|0\.|10\.|192\.168\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "::1" || h.startsWith("[::1]") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

export const GET: APIRoute = async ({ request }) => {
  const raw = new URL(request.url).searchParams.get("u") || "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("参数 u 不是合法 URL", { status: 400 });
  }
  if (target.protocol !== "https:") {
    return new Response("只代理 https 资源", { status: 400 });
  }
  if (isPrivateHost(target.hostname)) {
    return new Response("目标主机不被允许", { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(target.href, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
    });
    if (!upstream.ok || !upstream.body) {
      return new Response(`源站响应 ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return new Response(`源站不是图片（${contentType || "未知类型"}）`, { status: 415 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`取回失败: ${message}`, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
};
