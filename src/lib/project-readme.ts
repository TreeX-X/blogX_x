// Note: README 快照与手动展示字段分离，访问页面不请求 GitHub — see .agents/notes/2026-10-07-decision-project-showcase--617f02c5.md
export type ReadmeSnapshot = {
  summary: string;
  highlights: string[];
  sections: { title: string; text: string }[];
  images: { url: string; alt: string }[];
  sourceUrl: string;
  revision: string;
  fetchedAt: string;
};

export function githubRepository(raw: string) {
  const url = new URL(raw);
  const parts = url.pathname.replace(/\/$/, "").replace(/\.git$/, "").split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || parts.length !== 2
    || !parts.every(part => /^[\w.-]+$/.test(part) && part !== "." && part !== "..")) {
    throw new Error("请输入完整的 GitHub 仓库地址：https://github.com/作者/仓库");
  }
  return { owner: parts[0], repo: parts[1] };
}

function plainText(raw: string) {
  return raw.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<[^>]*>/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function assetUrl(raw: string, base: string) {
  try {
    const url = new URL(raw, base);
    if (url.protocol !== "https:" || /shields\.io|star-history|badge|logo|icon|header\.svg/i.test(url.href)) return null;
    // GitHub file links need the raw host to work as images.
    if (url.hostname === "github.com" && url.pathname.includes("/blob/")) {
      return `https://raw.githubusercontent.com${url.pathname.replace("/blob/", "/")}`;
    }
    return url.href;
  } catch { return null; }
}

export function extractReadme(markdown: string, context: { owner: string; repo: string; revision: string; path?: string; fetchedAt?: string }): ReadmeSnapshot {
  const { owner, repo, revision } = context;
  const path = context.path || "README.md";
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${revision}/${path}`;
  const images: ReadmeSnapshot["images"] = [];
  const imageSource = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "");
  const addImage = (src: string, alt: string) => {
    const url = assetUrl(src, base);
    if (url && !images.some(image => image.url === url) && images.length < 8) images.push({ url, alt: plainText(alt).slice(0, 250) });
  };
  for (const match of imageSource.matchAll(/<img\b[^>]*>/gi)) {
    const src = match[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    const alt = match[0].match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || "项目预览";
    if (src) addImage(src, alt);
  }
  for (const match of imageSource.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+["'][^)]*)?\)/g)) addImage(match[2], match[1]);

  const groups: { title: string; level: number; lines: string[] }[] = [];
  let current = { title: "项目介绍", level: 0, lines: [] as string[] };
  groups.push(current);
  let inCode = false;
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;
    const heading = line.match(/^(#{1,4})\s+(.+)/);
    if (heading) {
      current = { title: plainText(heading[2]), level: heading[1].length, lines: [] };
      groups.push(current); continue;
    }
    if (/^\s*(?:>|\||<|!\[|\[!|---|\*\*\*)/.test(line)) continue;
    const text = plainText(line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, ""));
    if (text.length > 20 && !/^(?:中文|English|一句话[：:])/.test(text)) current.lines.push(text);
  }
  const firstSection = groups.findIndex(group => group.level === 2);
  const intro = groups.slice(0, firstSection < 0 ? groups.length : firstSection);
  const summary = (intro.find(group => group.level === 3)?.title || intro.flatMap(group => group.lines)[0] || "").slice(0, 300);
  const sections = groups.slice(Math.max(firstSection, 0)).filter(group => group.level >= 2 && group.lines.length
    && !/安装|快速开始|平台支持|框架对比|关于|星级|license|contribut|quick start|installation/i.test(group.title))
    .slice(0, 4).map(group => ({ title: group.title.slice(0, 120), text: group.lines.slice(0, 3).join("\n\n").slice(0, 900) }));
  const featureHeadings = groups.slice(Math.max(firstSection, 0)).filter(group => group.level === 3 && group.lines.length);
  const bulletLabels = markdown.match(/^\s*[-*+]\s+\*\*[^*]+\*\*/gm) || [];
  const highlights = (featureHeadings.length ? featureHeadings.map(group => group.title.replace(/^\d+\s*[·.、-]\s*/, ""))
    : bulletLabels.map(label => plainText(label.replace(/^\s*[-*+]\s+/, "")).replace(/[：:]$/, "")))
    .filter((label, index, all) => label && all.indexOf(label) === index).slice(0, 3).map(label => label.slice(0, 180));
  return { summary, sections, highlights, images,
    sourceUrl: `https://github.com/${owner}/${repo}/blob/${revision}/${path}`,
    revision, fetchedAt: context.fetchedAt || new Date().toISOString() };
}

export async function fetchProjectReadme(repoUrl: string, fetcher: typeof fetch = fetch): Promise<ReadmeSnapshot> {
  const { owner, repo } = githubRepository(repoUrl);
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "BlogX-project-showcase" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const request = async (path: string) => {
    const response = await fetcher(`https://api.github.com/repos/${owner}/${repo}/${path}`, { headers, signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!response.ok) throw new Error(`GitHub 读取失败（HTTP ${response.status}），原有项目内容未更新`);
    return response.json();
  };
  const commits = await request("commits?per_page=1");
  const revision = commits[0]?.sha;
  if (typeof revision !== "string" || !/^[a-f0-9]{40}$/.test(revision)) throw new Error("GitHub 未返回有效仓库版本");
  const data = await request(`readme?ref=${revision}`);
  if (data.encoding !== "base64" || typeof data.content !== "string" || data.content.length > 700000) throw new Error("README 格式不受支持或内容过大");
  return extractReadme(Buffer.from(data.content, "base64").toString("utf8"), { owner, repo, revision, path: data.path });
}
