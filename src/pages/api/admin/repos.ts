import type { APIRoute } from "astro";
import { fail, json, listEntries, normalizeSlug, readJson, removeEntry, saveEntry, validateFields } from "./_helpers";

export const prerender = false;

/** 面板列表：slug 即 content 表 path，字段与 body 原样回显 */
export const GET: APIRoute = async () => {
  return json(await listEntries("repos"));
};

const write = async (request: Request, merge: boolean): Promise<Response> => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const slug = normalizeSlug(body.slug);
  if (!slug) return fail("slug required");
  const { slug: _slug, body: _markdown, ...fields } = body;
  const validated = validateFields("repos", fields);
  if (!validated.ok) return fail(validated.error);
  await saveEntry("repos", slug, validated, "", merge ? slug : null);
  return json({ ok: true, slug });
};

export const POST: APIRoute = async ({ request }) => write(request, false);

export const PUT: APIRoute = async ({ request }) => write(request, true);

export const DELETE: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const slug = normalizeSlug(body.slug);
  if (!slug) return fail("slug required");
  const result = await removeEntry("repos", slug);
  return json(result, result.status);
};
