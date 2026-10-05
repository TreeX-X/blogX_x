import type { APIRoute } from "astro";
import { fail, json, listEntries, entryExists, normalizeSlug, readJson, removeEntry, saveEntry, validateFields } from "./_helpers";

export const prerender = false;

/**
 * 名称 → slug：小写、空白与下划线折叠成连字符、丢掉除字母数字连字符以外的符号。
 * 不做 NFKC：全角字符必须原样保留，否则「规范文档：PRD」这类路径会被折成 Windows 非法的半角冒号。
 */
function slugifyName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** GET — 面板列表：slug 是 content 表 path，也是编辑与删除的身份 */
export const GET: APIRoute = async () => {
  return json(await listEntries("toolbox"));
};

/** POST — 新增工具。slug 缺省时由名称派生；撞车返回 409，不静默覆盖已有工具 */
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const slug = normalizeSlug(body.slug) ?? (typeof body.name === "string" ? slugifyName(body.name) : "");
  if (!slug) return fail("名称必填（无法派生出 slug）");
  if (await entryExists("toolbox", slug)) {
    return fail(`已存在 slug 为 "${slug}" 的工具，请换一个名称`, 409);
  }
  const { slug: _slug, body: _markdown, ...fields } = body;
  const validated = validateFields("toolbox", fields);
  if (!validated.ok) return fail(validated.error);
  await saveEntry("toolbox", slug, validated, "", null);
  return json({ ok: true, slug });
};

/** PUT — 按 slug 更新 */
export const PUT: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const slug = normalizeSlug(body.slug);
  if (!slug) return fail("slug required");
  const { slug: _slug, body: _markdown, ...fields } = body;
  const validated = validateFields("toolbox", fields);
  if (!validated.ok) return fail(validated.error);
  await saveEntry("toolbox", slug, validated, "", slug);
  return json({ ok: true, slug });
};

export const DELETE: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const slug = normalizeSlug(body.slug);
  if (!slug) return fail("slug required");
  const result = await removeEntry("toolbox", slug);
  return json(result, result.status);
};
