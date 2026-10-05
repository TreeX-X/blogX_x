import type { APIRoute } from "astro";
import { stat, readFile } from "node:fs/promises";
import { join, basename, resolve, isAbsolute } from "node:path";
import matter from "gray-matter";
import { fail, json, listEntries, normalizeSlug, readJson, removeEntry, saveEntry, validateFields } from "./_helpers";

export const prerender = false;

/**
 * 从本地 Skill 文件夹读 SKILL.md。面板只在 dev 可达，读取本机文件是它的本职；
 * 这里只做只读导入，不再整目录复制到 public/skills-download——那台目录与发布物无关，
 * zip 由 prebuild 的 pack-skills.mjs 从 .claude/skills 生成。
 */
async function readSkillFolder(folderPath: string): Promise<{
  ok: boolean;
  error?: string;
  slug?: string;
  entry?: Record<string, unknown>;
  body?: string;
}> {
  let resolved = folderPath;
  if (!isAbsolute(resolved)) {
    resolved = resolve(process.cwd(), resolved);
  }

  let folderStat;
  try {
    folderStat = await stat(resolved);
  } catch {
    return { ok: false, error: `路径不存在: ${resolved}` };
  }
  if (!folderStat.isDirectory()) {
    return { ok: false, error: `不是文件夹: ${resolved}` };
  }

  const skillMdPath = join(resolved, "SKILL.md");
  let raw: string;
  try {
    raw = await readFile(skillMdPath, "utf-8");
  } catch {
    return { ok: false, error: `文件夹中未找到 SKILL.md` };
  }

  /*-- gray-matter 是仓库统一的 frontmatter 序列化器（content-pull、fetch-articles 同款） --*/
  const { data: fm, content } = matter(raw);
  const dirName = basename(resolved);
  const frontmatter = fm as Record<string, unknown>;
  const name = typeof frontmatter.name === "string" ? frontmatter.name : "";

  return {
    ok: true,
    slug: dirName,
    body: content.trim(),
    entry: {
      title: name || dirName,
      description: typeof frontmatter.description === "string" ? frontmatter.description : "",
      skillDir: dirName,
      version: typeof frontmatter.version === "string" ? frontmatter.version : "",
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      author: typeof frontmatter.author === "string" ? frontmatter.author : "",
      license: typeof frontmatter.license === "string" ? frontmatter.license : "",
    },
  };
}

/** GET — 面板列表：slug 即 content 表 path，字段与 body 原样回显 */
export const GET: APIRoute = async () => {
  return json(await listEntries("skills"));
};

/** POST — 从本地文件夹导入，或按表单字段新建 */
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");

  if (typeof body.path === "string" && body.path.trim()) {
    const result = await readSkillFolder(body.path.trim());
    if (!result.ok || !result.entry || !result.slug) return fail(result.error ?? "导入失败");
    const validated = validateFields("skills", result.entry);
    if (!validated.ok) return fail(validated.error);
    await saveEntry("skills", result.slug, validated, result.body ?? "", null);
    return json({ ok: true, slug: result.slug });
  }

  const slug = normalizeSlug(body.slug);
  if (!slug) return fail("slug 或 path 必填");
  const { slug: _slug, path: _path, body: markdown, ...fields } = body;
  const validated = validateFields("skills", fields);
  if (!validated.ok) return fail(validated.error);
  await saveEntry("skills", slug, validated, typeof markdown === "string" ? markdown : "", null);
  return json({ ok: true, slug });
};

/** PUT — 更新已有条目（在既有 frontmatter 上合并，保留面板不展示的外来键） */
export const PUT: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const slug = normalizeSlug(body.slug);
  if (!slug) return fail("slug required");
  const { slug: _slug, body: markdown, ...fields } = body;
  const validated = validateFields("skills", fields);
  if (!validated.ok) return fail(validated.error);
  await saveEntry("skills", slug, validated, typeof markdown === "string" ? markdown : undefined, slug);
  return json({ ok: true, slug });
};

export const DELETE: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const slug = normalizeSlug(body.slug);
  if (!slug) return fail("slug required");
  const result = await removeEntry("skills", slug);
  return json(result, result.status);
};
