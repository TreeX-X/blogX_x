import { listCollection } from "./content-store";
import type { ContentRecord } from "./content-store";

export interface ToolboxItem {
  category: string;
  name: string;
  url: string;
  summary: string;
  icon?: string;
}

/**
 * 工具箱唯一数据入口：读 LanceDB `content` 表的 toolbox 集合。
 * 面板写入即时可见，不必像其它集合那样等 content-pull 落盘；LanceDB 不可达时
 * listCollection 返回空数组，页面退到"尚未配置"的空态。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 */
export async function getToolboxItems(): Promise<ToolboxItem[]> {
  const records = await listCollection("toolbox");
  return records.map(toToolboxItem).filter((item): item is ToolboxItem => item !== null);
}

function toToolboxItem(record: ContentRecord): ToolboxItem | null {
  let frontmatter: Record<string, unknown>;
  try {
    const parsed = JSON.parse(record.frontmatter);
    if (!parsed || typeof parsed !== "object") return null;
    frontmatter = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const name = str(frontmatter.name);
  const url = str(frontmatter.url);
  const category = str(frontmatter.category);
  if (!name || !url || !category) return null;

  return {
    name,
    url,
    category,
    summary: str(frontmatter.summary),
    icon: str(frontmatter.icon) || undefined,
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function getToolboxIconUrl(item: ToolboxItem) {
  if (item.icon) return item.icon;

  const hostname = getHostname(item.url);
  if (!hostname) return "";

  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

export function groupToolboxItems(items: ToolboxItem[]) {
  return items.reduce(
    (acc, item) => {
      const group = acc.get(item.category) || [];
      group.push(item);
      acc.set(item.category, group);
      return acc;
    },
    new Map<string, ToolboxItem[]>()
  );
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreToolboxItem(item: ToolboxItem, query: string) {
  const normalizedQuery = normalizeText(query);
  const haystack = normalizeText([item.category, item.name, item.summary, item.url, item.icon ?? ""].join(" "));

  if (!normalizedQuery) return 0;
  if (haystack.includes(normalizedQuery)) return 100 + normalizedQuery.length;

  const terms = normalizedQuery.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 0);
  if (terms.length === 0) return 0;

  return terms.reduce((score, term) => score + (haystack.includes(term) ? 12 : 0), 0);
}

/** 纯函数：在已取回的条目里打分排序。取数一律经 getToolboxItems，调用方不碰库 */
export function searchToolboxItems(items: ToolboxItem[], query: string, limit = 6) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  return [...items]
    .map((item) => ({ item, score: scoreToolboxItem(item, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "zh-CN"))
    .slice(0, limit)
    .map(({ item }) => ({
      id: item.name,
      title: item.name,
      content: item.summary,
      url: item.url,
      collection: item.category,
      icon: getToolboxIconUrl(item),
    }));
}
