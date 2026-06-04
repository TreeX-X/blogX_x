import type { APIRoute } from "astro";
import { readdir, readFile, writeFile, unlink, mkdir, stat, cp } from "node:fs/promises";
import { join, basename, resolve, isAbsolute } from "node:path";

export const prerender = false;

const SKILLS_DIR = join(process.cwd(), "src/content/skills");
const DOWNLOAD_DIR = join(process.cwd(), "public/skills-download");

async function ensureDir() {
  await mkdir(SKILLS_DIR, { recursive: true });
  await mkdir(DOWNLOAD_DIR, { recursive: true });
}

function parseFrontmatter(content: string) {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: normalized };
  const lines = match[1].split("\n");
  const data: Record<string, any> = {};
  let currentKey = "";
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      let val: any = kv[2].trim();
      if (val.startsWith('"') && val.endsWith('"') && val.length > 1) val = val.slice(1, -1);
      if (val.startsWith("[") && val.endsWith("]")) {
        try { val = JSON.parse(val.replace(/'/g, '"')); } catch {}
      }
      data[currentKey] = val;
    } else if (currentKey && line.trim()) {
      const prev = data[currentKey];
      if (typeof prev === "string") data[currentKey] = prev + " " + line.trim();
    }
  }
  return { data, body: match[2].trim() };
}

function toFrontmatter(data: Record<string, any>, body: string): string {
  let fm = "---\n";
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      fm += `${k}: [${v.map((t: string) => `"${t}"`).join(", ")}]\n`;
    } else if (typeof v === "boolean") {
      fm += `${k}: ${v}\n`;
    } else {
      fm += `${k}: "${v}"\n`;
    }
  }
  fm += "---\n";
  if (body) fm += `\n${body}\n`;
  return fm;
}

function deriveTitle(name: string, dir: string): string {
  const source = name || dir;
  if (source.includes("-") || source.includes("_")) {
    return source.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return source;
}

/** Read SKILL.md from any path and return parsed entry */
async function readSkillFolder(folderPath: string): Promise<{
  ok: boolean;
  error?: string;
  dirName?: string;
  entry?: Record<string, any>;
  body?: string;
  fileCount?: number;
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

  const { data: fm, body } = parseFrontmatter(raw);
  const dirName = basename(resolved);

  // Count files
  let fileCount = 0;
  try {
    const walk = async (dir: string) => {
      const items = await readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name === "node_modules" || item.name === ".git") continue;
        fileCount++;
        if (item.isDirectory()) await walk(join(dir, item.name));
      }
    };
    await walk(resolved);
  } catch {}

  return {
    ok: true,
    dirName,
    fileCount,
    body,
    entry: {
      title: deriveTitle(fm.name, dirName),
      description: fm.description || "",
      skillDir: dirName,
      version: fm.version || "",
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      author: fm.author || "",
      license: fm.license || "",
    },
  };
}

/** GET — list content entries */
export const GET: APIRoute = async () => {
  await ensureDir();
  const files = (await readdir(SKILLS_DIR)).filter((f) => f.endsWith(".md"));
  const skills = [];
  for (const file of files) {
    const raw = await readFile(join(SKILLS_DIR, file), "utf-8");
    const { data, body } = parseFrontmatter(raw);
    skills.push({ slug: file.replace(/\.md$/, ""), ...data, body });
  }
  return new Response(JSON.stringify(skills), { headers: { "Content-Type": "application/json" } });
};

/** POST — create new entry or import from folder path */
export const POST: APIRoute = async ({ request }) => {
  await ensureDir();
  const body = await request.json();

  // Import from folder path
  if (body.path) {
    const result = await readSkillFolder(body.path);
    if (!result.ok) return new Response(JSON.stringify({ error: result.error }), { status: 400 });

    const { dirName, entry, body: mdBody } = result!;
    await writeFile(join(SKILLS_DIR, `${dirName}.md`), toFrontmatter(entry!, mdBody || ""), "utf-8");

    // Copy folder to public/skills-download/ for zip download support
    const destDir = join(DOWNLOAD_DIR, dirName!);
    try {
      await cp(body.path, destDir, { recursive: true });
    } catch (e) {
      console.warn("Copy to download dir failed:", e);
    }

    return new Response(JSON.stringify({ ok: true, slug: dirName }));
  }

  // Create new entry from form data
  const { slug, body: mdBody2, ...formData } = body;
  if (!slug) return new Response(JSON.stringify({ error: "slug 或 path 必填" }), { status: 400 });
  await writeFile(join(SKILLS_DIR, `${slug}.md`), toFrontmatter(formData, mdBody2 || ""), "utf-8");
  return new Response(JSON.stringify({ ok: true, slug }));
};

/** PUT — update existing content entry */
export const PUT: APIRoute = async ({ request }) => {
  await ensureDir();
  const { slug, body: mdBody, ...formData } = await request.json();
  if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });
  await writeFile(join(SKILLS_DIR, `${slug}.md`), toFrontmatter(formData, mdBody || ""), "utf-8");
  return new Response(JSON.stringify({ ok: true }));
};

/** DELETE — remove content entry */
export const DELETE: APIRoute = async ({ request }) => {
  const { slug } = await request.json();
  if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });
  try { await unlink(join(SKILLS_DIR, `${slug}.md`)); } catch {}
  return new Response(JSON.stringify({ ok: true }));
};
