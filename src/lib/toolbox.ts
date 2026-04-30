export interface ToolboxItem {
  category: string;
  name: string;
  url: string;
  summary: string;
  icon?: string;
}

export const toolboxItems: ToolboxItem[] = [
  {
    category: "开发工具",
    name: "JSONLint",
    url: "https://jsonlint.com/",
    summary: "在线 JSON 校验与格式化工具，支持错误定位。",
  },
  {
    category: "在线工具",
    name: "色彩选取器",
    url: "https://imagecolorpicker.com/",
    summary: "快速从图片或调色板中选取颜色并复制色值（无图标示例）。",
  },
  {
    category: "开发工具",
    name: "Regex101",
    url: "https://regex101.com/",
    summary: "正则表达式测试与调试工具，带说明与匹配信息。",
  },
];

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

export function groupToolboxItems(items: ToolboxItem[] = toolboxItems) {
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

export function searchToolboxItems(query: string, limit = 6) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  return [...toolboxItems]
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