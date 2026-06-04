import type { APIRoute } from "astro";
import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const prerender = false;

const PROJECTS_DIR = join(process.cwd(), "src/content/projects");

async function ensureDir() {
  await mkdir(PROJECTS_DIR, { recursive: true });
}

function parseFrontmatter(content: string) {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: normalized };
  const lines = match[1].split("\n");
  const data: Record<string, any> = {};
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      let val: any = kv[2].trim();
      if (val.startsWith('"') && val.endsWith('"') && val.length > 1) val = val.slice(1, -1);
      if (val.startsWith("[") && val.endsWith("]")) {
        try { val = JSON.parse(val.replace(/'/g, '"')); } catch {}
      }
      data[kv[1]] = val;
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

export const GET: APIRoute = async () => {
  await ensureDir();
  const files = (await readdir(PROJECTS_DIR)).filter((f) => f.endsWith(".md"));
  const projects = [];
  for (const file of files) {
    const raw = await readFile(join(PROJECTS_DIR, file), "utf-8");
    const { data } = parseFrontmatter(raw);
    projects.push({ slug: file.replace(/\.md$/, ""), ...data });
  }
  return new Response(JSON.stringify(projects), { headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  await ensureDir();
  const { slug, ...data } = await request.json();
  if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });
  await writeFile(join(PROJECTS_DIR, `${slug}.md`), toFrontmatter(data, ""), "utf-8");
  return new Response(JSON.stringify({ ok: true }));
};

export const PUT: APIRoute = async ({ request }) => {
  await ensureDir();
  const { slug, ...data } = await request.json();
  if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });
  await writeFile(join(PROJECTS_DIR, `${slug}.md`), toFrontmatter(data, ""), "utf-8");
  return new Response(JSON.stringify({ ok: true }));
};

export const DELETE: APIRoute = async ({ request }) => {
  const { slug } = await request.json();
  if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });
  try { await unlink(join(PROJECTS_DIR, `${slug}.md`)); } catch {}
  return new Response(JSON.stringify({ ok: true }));
};
