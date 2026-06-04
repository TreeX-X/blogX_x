import type { APIRoute } from "astro";
import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const prerender = false;

const POSTS_DIR = join(process.cwd(), "src/content/posts");

async function ensureDir() {
  await mkdir(POSTS_DIR, { recursive: true });
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };
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
  const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith(".md"));
  const posts = [];
  for (const file of files) {
    const raw = await readFile(join(POSTS_DIR, file), "utf-8");
    const { data, body } = parseFrontmatter(raw);
    posts.push({ slug: file.replace(/\.md$/, ""), ...data, body });
  }
  return new Response(JSON.stringify(posts), { headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  await ensureDir();
  const { slug, ...data } = await request.json();
  if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });
  const filePath = join(POSTS_DIR, `${slug}.md`);
  const content = toFrontmatter(data, data.body || "");
  await writeFile(filePath, content, "utf-8");
  return new Response(JSON.stringify({ ok: true }));
};

export const PUT: APIRoute = async ({ request }) => {
  await ensureDir();
  const { slug, ...data } = await request.json();
  if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });
  const filePath = join(POSTS_DIR, `${slug}.md`);
  const content = toFrontmatter(data, data.body || "");
  await writeFile(filePath, content, "utf-8");
  return new Response(JSON.stringify({ ok: true }));
};

export const DELETE: APIRoute = async ({ request }) => {
  const { slug } = await request.json();
  if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });
  await unlink(join(POSTS_DIR, `${slug}.md`));
  return new Response(JSON.stringify({ ok: true }));
};
