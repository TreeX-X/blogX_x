import type { APIRoute } from "astro";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const prerender = false;

const TOOLBOX_PATH = join(process.cwd(), "src/lib/toolbox.ts");

function serializeToolbox(items: any[]): string {
  const lines = items.map((item) => {
    const fields = [`    category: "${item.category}"`, `    name: "${item.name}"`, `    url: "${item.url}"`, `    summary: "${item.summary}"`];
    if (item.icon) fields.push(`    icon: "${item.icon}"`);
    return `  {\n${fields.join(",\n")},\n  }`;
  });
  return `export interface ToolboxItem {
  category: string;
  name: string;
  url: string;
  summary: string;
  icon?: string;
}

export const toolboxItems: ToolboxItem[] = [
${lines.join(",\n")}
];
`;
}

function parseToolboxItems(content: string): any[] {
  const items: any[] = [];
  const blockRe = /\{\s*category:\s*"([^"]*)",?\s*name:\s*"([^"]*)",?\s*url:\s*"([^"]*)",?\s*summary:\s*"([^"]*)",?\s*(?:icon:\s*"([^"]*)",?\s*)?\}/g;
  let m;
  while ((m = blockRe.exec(content))) {
    const item: any = { category: m[1], name: m[2], url: m[3], summary: m[4] };
    if (m[5]) item.icon = m[5];
    items.push(item);
  }
  return items;
}

async function readItems(): Promise<any[]> {
  const raw = await readFile(TOOLBOX_PATH, "utf-8");
  return parseToolboxItems(raw);
}

async function writeItems(items: any[]) {
  const content = serializeToolbox(items);
  await writeFile(TOOLBOX_PATH, content, "utf-8");
}

export const GET: APIRoute = async () => {
  const items = await readItems();
  return new Response(JSON.stringify(items), { headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  const newItem = await request.json();
  const items = await readItems();
  items.push(newItem);
  await writeItems(items);
  return new Response(JSON.stringify({ ok: true }));
};

export const PUT: APIRoute = async ({ request }) => {
  const { index, ...updated } = await request.json();
  const items = await readItems();
  if (index < 0 || index >= items.length) {
    return new Response(JSON.stringify({ error: "invalid index" }), { status: 400 });
  }
  items[index] = updated;
  await writeItems(items);
  return new Response(JSON.stringify({ ok: true }));
};

export const DELETE: APIRoute = async ({ request }) => {
  const { index } = await request.json();
  const items = await readItems();
  if (index < 0 || index >= items.length) {
    return new Response(JSON.stringify({ error: "invalid index" }), { status: 400 });
  }
  items.splice(index, 1);
  await writeItems(items);
  return new Response(JSON.stringify({ ok: true }));
};
