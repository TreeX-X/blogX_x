import type { APIRoute } from "astro";
import {
  deleteEntry,
  entryExists,
  fail,
  json,
  listNestedEntries,
  normalizeNestedPath,
  readJson,
  removeEntry,
  saveEntry,
  validateFields,
} from "./_helpers";

export const prerender = false;

const COLLECTION = "wiki";

const PATH_HINT =
  'path 必填：集合内相对路径，正斜杠分隔、不含扩展名，不接受 .. 与 \\ : * ? " < > |';

/** GET — 面板列表。path 是集合内嵌套路径（「AI使用技巧/AI评选」），不是扁平 slug */
export const GET: APIRoute = async () => {
  return json(await listNestedEntries(COLLECTION));
};

/** POST — 在 path 新建。撞车返回 409：嵌套路径没有"新建覆盖"的合理场景 */
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const path = normalizeNestedPath(body.path);
  if (!path) return fail(PATH_HINT);
  if (await entryExists(COLLECTION, path)) {
    return fail(`路径已存在: ${path}`, 409);
  }
  return persist(body, path, null);
};

/**
 * PUT — 编辑，移动与重命名也走这里：path 是目标路径，from 是原路径，两者不同即搬家。
 * 先写目标再删源：写失败时源记录还在，不会把一次失败编辑变成一次内容丢失。
 */
export const PUT: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const path = normalizeNestedPath(body.path);
  if (!path) return fail(PATH_HINT);
  const rawFrom = typeof body.from === "string" ? body.from.trim() : "";
  const from = rawFrom === "" ? null : normalizeNestedPath(rawFrom);
  if (rawFrom !== "" && !from) return fail(`from 路径非法: ${rawFrom}`);
  /*-- 只有"要求搬家"时才查目标是否被占：原地编辑（不带 from）就该覆盖写入，别把自己 409 掉 --*/
  if (from && from !== path && (await entryExists(COLLECTION, path))) {
    return fail(`目标路径已有记录: ${path}`, 409);
  }
  return persist(body, path, from);
};

export const DELETE: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const path = normalizeNestedPath(body.path);
  if (!path) return fail(PATH_HINT);
  const result = await removeEntry(COLLECTION, path);
  return json(result, result.status);
};

async function persist(
  body: Record<string, unknown>,
  path: string,
  from: string | null
): Promise<Response> {
  const { path: _path, from: _from, body: markdown, ...fields } = body;
  const validated = validateFields(COLLECTION, fields);
  if (!validated.ok) return fail(validated.error);
  await saveEntry(COLLECTION, path, validated, typeof markdown === "string" ? markdown : undefined, from ?? path);
  if (from && from !== path) await deleteEntry(COLLECTION, from);
  return json({ ok: true, path });
}
