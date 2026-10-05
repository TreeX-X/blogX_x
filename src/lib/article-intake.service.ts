/**
 * AI 上传处理通道：抓取 → GLM 提取 → 翻译 → 落草稿 → 校验发布
 *
 * 三种输入（粘贴 URL / 上传文件 / 粘贴正文）汇成同一条流水线，产物只有一种：一条
 * `collection: "posts"`、`status: "draft"` 的 content 表记录，含 GLM 提取的结构化
 * frontmatter 与双语正文（originalBody = 原文，translatedBody = 译文）。
 * CLI（scripts/content-intake.mjs、scripts/content-publish.mjs）与 dev 面板
 * （src/pages/api/admin/intake.ts）共用本模块，抓取、翻译、校验、发布各只有一份实现。
 *
 * 本模块刻意不重复实现的三件事：
 * - 读写一律走 content-store（LanceDB content 表的唯一入口），这里不建连接、不拼 SQL；
 * - 字段校验一律走 content-schemas 的 zod schema，这里不手写必填项；
 * - 翻译一律走 article-translation.service.mjs 的 detectLanguage / translateText。
 *
 * 草稿口径沿用 T3 裁定：content 表记录的 status 字段是草稿的权威口径，content-pull
 * 只写盘 status: published，所以草稿天然不进构建产物；frontmatter 里的 isDraft 是
 * 遗留物（glob loader 过滤用），本模块一律写 false，不与 status 混用。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 * Note: 草稿态以 content 表 status 为权威口径 — see .agents/notes/2026-10-05-task-t3-admin-to-cloud--870946b7.md
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";
/*-- 相对导入带显式扩展名：本模块同时被 astro（Vite 解析，扩展名可有可无）与
     node --experimental-strip-types 的 CLI（Node ESM 解析，必须带扩展名）加载 --*/
import { validateCollectionFields, type CollectionKey } from "./content-schemas.ts";
import {
  deleteEntry,
  getEntry,
  listCollection,
  setStatus,
  upsertEntry,
  type ContentRecord,
} from "./content-store.ts";
import { detectLanguage, translateText } from "./article-translation.service.mjs";

/*-- intake 只产 posts：双语正文（originalBody / translatedBody）是 posts 独有的两列 --*/
export const INTAKE_COLLECTION: CollectionKey = "posts";

/*-- GLM 配置与翻译服务同一套默认值：改翻译端点时两边一起改（本模块只多一个提取用的 system prompt）--*/
const GLM_TIMEOUT_MS = 120_000;
const GLM_EXTRACT_MAX_CHARS = 8000;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0 (compatible; BlogX_x/1.0; +https://blogx-x.vercel.app)";

/*-- 内容出仓后 content 表变更不会触发 Vercel 重建（git push 才触发），发布必须主动打钩子。
     变量缺失不是错误：草稿已入表，只是站点不自动更新，故只警告不抛错 --*/
export const DEPLOY_HOOK_ENV = "VERCEL_DEPLOY_HOOK";
const DEPLOY_HOOK_MISSING_WARNING =
  `未配置 Deploy Hook（${DEPLOY_HOOK_ENV}），内容已写入 content 表但站点不会自动重建。` +
  `请在 Vercel 项目 → Settings → Git → Deploy Hooks 创建 Hook 并把完整 URL 填进 .env 的 ${DEPLOY_HOOK_ENV}，` +
  `或手动部署一次 / git push 一次。`;

/*===== 输入与产物类型 =====*/

export type IntakeSourceKind = "url" | "file" | "text";
/** html = Readability 产物，走富媒体（占位符式）翻译；markdown = 粘贴/上传的文本，整篇直译 */
export type IntakeBodyKind = "html" | "markdown";

export interface IntakeRequest {
  source: IntakeSourceKind;
  /** source=url 时必填 */
  url?: string;
  /** source=file：CLI 传本地路径 */
  filePath?: string;
  /** source=file：面板传已读出的文件名（只用于推断 sourceUrl 与提示） */
  filename?: string;
  /** source=file / text：面板传已读出的文本内容 */
  text?: string;
  /** file / text 输入可选补一个原文链接；缺省时写 urn 占位（posts.sourceUrl 是必填 URL） */
  sourceUrl?: string;
}

export interface IntakeOptions {
  /** false = 只打印不写库（CLI --dry-run） */
  write?: boolean;
  onProgress?: (message: string) => void;
}

export interface IntakeDraft {
  record: ContentRecord;
  frontmatter: Record<string, unknown>;
  /** GLM 提取/翻译失败等原因：草稿照常落库，但失败必须随草稿可见 */
  warnings: string[];
}

export interface DraftSummary {
  path: string;
  title: string;
  description: string;
  tags: string[];
  date: string;
  originalAuthor: string;
  sourceUrl: string;
  originalLang: string;
  /** intake 记录的来源与成败：失败时 error 带上原因 */
  intakeSource: string;
  intakeStatus: "ok" | "failed" | "unknown";
  intakeError: string;
  updatedAt: string;
  bodyLength: number;
  originalBodyLength: number;
  translatedBodyLength: number;
}

export interface PublishReport {
  collection: CollectionKey;
  path: string;
  published: boolean;
  frontmatter: Record<string, unknown>;
  warnings: string[];
  deployHook: { triggered: boolean; warning?: string };
}

/** 字段校验失败：带着逐条 issue 抛给调用方（CLI 列字段错误，接口回 400），且不改 status */
export class PublishValidationError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(`字段校验失败，未发布：${issues.join("; ")}`);
    this.name = "PublishValidationError";
    this.issues = issues;
  }
}

/*===== GLM 调用 =====*/

function glmConfig() {
  return {
    apiKey: process.env.GLM_API_KEY,
    baseUrl: process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    model: process.env.GLM_MODEL || "glm-4.5-air",
  };
}

/** 一次 GLM chat completion；非 2xx 与网络错误都抛错（调用方据此判定失败，不静默吞掉） */
async function callGlm(
  messages: Array<{ role: "system" | "user"; content: string }>,
  timeoutMs = GLM_TIMEOUT_MS
): Promise<string> {
  const config = glmConfig();
  if (!config.apiKey) {
    throw new Error("GLM_API_KEY 未配置");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, messages, temperature: 0.3 }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 300);
      throw new Error(`GLM HTTP ${resp.status}: ${detail}`);
    }
    const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
      throw new Error("GLM 返回空内容");
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

const EXTRACT_SYSTEM_PROMPT = `你是内容元数据提取助手。阅读文章原文，只输出一个 JSON 对象，不要解释、不要代码栅栏。字段：
{
  "title": "原文标题，保留原文语言",
  "description": "60-160 字摘要，概括要点，语言与正文一致",
  "tags": ["3-6 个关键词，短词，不带 #"],
  "date": "发布日期，YYYY-MM-DD；无法判断输出 null",
  "originalAuthor": "原作者或机构名；无法判断输出 null"
}
不确定的字段输出 null，不要编造。`;

interface ExtractedFields {
  title?: string;
  description?: string;
  tags?: string[];
  date?: string;
  originalAuthor?: string;
}

/** 去掉 LLM 偶尔会包裹的 ```json ... ``` 栅栏 */
function stripLlmFence(content: string): string {
  const trimmed = String(content || "").trim();
  const matched = trimmed.match(/^```(?:json|JSON)?\s*\n([\s\S]*?)\n```\s*$/);
  return matched ? matched[1] : trimmed;
}

/** 取第一个 { 到最后一个 } 之间做 JSON.parse，容忍模型前后多余的话 */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const text = stripLlmFence(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeExtracted(parsed: Record<string, unknown> | null): ExtractedFields {
  if (!parsed) return {};
  const out: ExtractedFields = {};
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  if (title) out.title = title;
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  if (description) out.description = description;
  const originalAuthor =
    typeof parsed.originalAuthor === "string" ? parsed.originalAuthor.trim() : "";
  if (originalAuthor) out.originalAuthor = originalAuthor;
  if (Array.isArray(parsed.tags)) {
    const tags = parsed.tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 8);
    if (tags.length) out.tags = tags;
  }
  const date = normalizeDate(typeof parsed.date === "string" ? parsed.date : "");
  if (date) out.date = date;
  return out;
}

/** 规整为 ISO 日期串（postsSchema 的 date 是 z.coerce.date()，ISO 串最稳）；无法解析返回 "" */
function normalizeDate(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = new Date(matched ? `${matched[1]}-${matched[2]}-${matched[3]}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/** frontmatter 的 date：gray-matter 把 YAML 时间戳解析成 Date 对象，不是字符串 */
function frontmatterDate(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  return typeof value === "string" ? normalizeDate(value) : "";
}

async function extractFrontmatterWithGlm(
  input: { title: string; description: string; author: string; plainText: string; sourceUrl: string },
  onProgress: (message: string) => void
): Promise<{ fields: ExtractedFields; error: string }> {
  const hint = [
    input.sourceUrl ? `来源：${input.sourceUrl}` : "",
    input.title ? `页面标题：${input.title}` : "",
    input.author ? `页面作者：${input.author}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const raw = await callGlm([
      { role: "system", content: EXTRACT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${hint}\n\n正文（前 ${GLM_EXTRACT_MAX_CHARS} 字符）：\n${input.plainText.slice(0, GLM_EXTRACT_MAX_CHARS)}`,
      },
    ]);
    const fields = normalizeExtracted(parseJsonObject(raw));
    if (!Object.keys(fields).length) {
      return { fields: {}, error: "GLM 提取结果不是可用的 JSON 对象" };
    }
    onProgress("GLM frontmatter 提取完成");
    return { fields, error: "" };
  } catch (error) {
    return { fields: {}, error: `GLM frontmatter 提取失败: ${errText(error)}` };
  }
}

function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/*===== 抓取：URL → 结构化原文 =====*/

interface FetchedPage {
  html: string;
  textContent: string;
  title: string;
  description: string;
  author: string;
  coverImage: string;
  publishedTime: string;
  keywords: string[];
}

/*-- linkedom 的 parseHTML 返回 Window & typeof globalThis，document 属性解析不出 Document
     类型（其 .d.ts 里 Window 无此声明）。按本文件实际用到的成员收一次窄即可 --*/
interface DomTree {
  document: Document;
  body: HTMLElement;
}

async function parseBody(html: string): Promise<DomTree> {
  const { parseHTML } = await import("linkedom");
  /*-- linkedom 的 parseHTML 返回 Window（document 挂在 Window 上，而不在 html 上）--*/
  const window = parseHTML(`<!DOCTYPE html><html><body>${html || ""}</body></html>`) as unknown as {
    document: Document;
  };
  return { document: window.document, body: window.document.body };
}

async function fetchPage(url: string, onProgress: (message: string) => void): Promise<FetchedPage> {
  onProgress(`抓取 ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    /*-- 动态导入：readability / linkedom 只在 intake 路径上需要，静态导入会把这两个依赖拖进
         SSR bundle（与 content-store 动态导入 lancedb 同一考虑）--*/
    const { Readability } = await import("@mozilla/readability");
    const { document } = await parseBody(html);
    const parsed = new Readability(document).parse();
    if (!parsed || !parsed.textContent?.trim()) {
      throw new Error("Readability 解析失败（页面可能需登录或无可读正文）");
    }
    const meta = (selector: string) =>
      document.querySelector(selector)?.getAttribute("content")?.trim() || "";
    return {
      html: parsed.content || "",
      textContent: parsed.textContent || "",
      title: parsed.title || "",
      description:
        meta('meta[name="description"]') ||
        meta('meta[property="og:description"]') ||
        parsed.excerpt ||
        "",
      author: meta('meta[name="author"]') || meta('meta[property="article:author"]') || parsed.byline || "",
      coverImage: meta('meta[property="og:image"]'),
      publishedTime:
        meta('meta[property="article:published_time"]') || meta('meta[name="date"]'),
      keywords: meta('meta[name="keywords"]')
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
  } finally {
    clearTimeout(timer);
  }
}

/*===== 富媒体翻译：HTML 文本节点占位 → LLM → 回填 → DOM 转 Markdown =====
   以下 7 个函数自 scripts/fetch-articles.mjs 原样抽出（f6f78001 / T5 的 fetch-articles
   改造会改为从本模块 import 并删除脚本内那份副本，届时不再有两份实现）。                        */

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** 深度优先遍历 root 下的所有文本节点，回调收到 textNode */
function walkTextNodes(root: Node, callback: (textNode: Node) => void): void {
  if (!root || !root.childNodes) return;
  const stack: Node[] = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    for (const child of Array.from(cur.childNodes)) {
      if (!child) continue;
      if (child.nodeType === TEXT_NODE) {
        callback(child);
      } else if (child.nodeType === ELEMENT_NODE) {
        stack.push(child);
      }
    }
  }
}

/** 对每个非空文本节点插入 [[T_n]]…[[/T_n]] 占位符，让 LLM 只动文本、不动标签 */
async function buildTranslateInput(html: string): Promise<{ markedHtml: string; pairs: number }> {
  const { body } = await parseBody(html);
  let idx = 0;
  walkTextNodes(body, (textNode) => {
    const raw = textNode.textContent || "";
    if (!raw.trim()) return;
    textNode.textContent = `[[T_${idx}]]${raw}[[/T_${idx}]]`;
    idx += 1;
  });
  return { markedHtml: body.innerHTML, pairs: idx };
}

function collapseInline(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

/** 最小 Markdown 转义：避免 alt/text 含 ] 或换行导致图片/链接语法 malformed */
function mdEscape(text: string): string {
  return String(text || "").replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\n/g, " ");
}

/** 递归序列化节点为 Markdown */
function serializeNode(node: Node): string {
  if (!node) return "";
  if (node.nodeType === TEXT_NODE) {
    return node.textContent || "";
  }
  if (node.nodeType !== ELEMENT_NODE) return "";
  const element = node as Element;
  const tag = (element.tagName || "").toLowerCase();
  const inner = serializeChildren(element);
  switch (tag) {
    case "h1": return `\n\n# ${collapseInline(inner)}\n\n`;
    case "h2": return `\n\n## ${collapseInline(inner)}\n\n`;
    case "h3": return `\n\n### ${collapseInline(inner)}\n\n`;
    case "h4": return `\n\n#### ${collapseInline(inner)}\n\n`;
    case "h5": return `\n\n##### ${collapseInline(inner)}\n\n`;
    case "h6": return `\n\n###### ${collapseInline(inner)}\n\n`;
    case "p": {
      const text = inner.replace(/\n{2,}/g, "\n").trim();
      return text ? `\n\n${text}\n\n` : "";
    }
    case "br": return "  \n";
    case "hr": return "\n\n---\n\n";
    case "strong":
    case "b": return `**${inner}**`;
    case "em":
    case "i": return `*${inner}*`;
    case "del":
    case "s": return `~~${inner}~~`;
    case "code": {
      /*-- <pre><code> 由 pre 节点处理；此处是行内 code（parentElement 即 lib.dom 里收窄后的父元素）--*/
      const parentTag = element.parentElement ? element.parentElement.tagName.toLowerCase() : "";
      if (parentTag === "pre") return inner;
      return `\`${inner}\``;
    }
    case "pre": {
      const codeEl = element.querySelector("code");
      const cls = codeEl ? codeEl.getAttribute("class") || "" : "";
      const langMatch =
        cls.match(/(?:^|\s)language-([\w+-]+)/i) || cls.match(/(?:^|\s)lang-([\w+-]+)/i);
      const lang = langMatch ? langMatch[1] : "";
      const code = codeEl ? serializeChildren(codeEl) : inner;
      /*-- 仅剥最多 1 个首尾换行（HTML 格式产生），保留代码块内含的换行 --*/
      const cleaned = code.replace(/^\n|\n$/, "");
      return `\n\n\`\`\`${lang}\n${cleaned}\n\`\`\`\n\n`;
    }
    case "blockquote": {
      const stripped = inner.replace(/\n{3,}/g, "\n\n").trim();
      const quoted = stripped.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n");
      return quoted ? `\n\n${quoted}\n\n` : "";
    }
    case "ul":
    case "ol": {
      const children = Array.from(element.children);
      const lines: string[] = [];
      let n = 1;
      for (const li of children) {
        if ((li.tagName || "").toLowerCase() !== "li") continue;
        const marker = tag === "ol" ? `${n}.` : "-";
        n += 1;
        const content = serializeChildren(li).replace(/\n+/g, "\n    ").trim();
        lines.push(`${marker} ${content}`.replace(/\s+$/g, ""));
      }
      return lines.length ? `\n\n${lines.join("\n")}\n\n` : "";
    }
    case "li": return inner; /*-- 由 ul/ol 节点统一处理前缀 --*/
    case "a": return `[${mdEscape(inner)}](${mdEscape(element.getAttribute("href") || "")})`;
    case "img": return `![${mdEscape(element.getAttribute("alt") || "")}](${mdEscape(element.getAttribute("src") || "")})`;
    case "video": {
      /*-- 保留 <video src> 或内嵌 <source src> 的 URL --*/
      const src = element.getAttribute("src") || "";
      const source = element.querySelector("source");
      const finalSrc = src || (source ? source.getAttribute("src") || "" : "");
      return finalSrc ? `\n\n[video](${finalSrc})\n\n` : "";
    }
    case "picture": {
      const img = element.querySelector("img");
      return img ? serializeNode(img) : "";
    }
    case "figure": {
      const img = element.querySelector("img");
      const cap = element.querySelector("figcaption");
      const imgMd = img ? serializeNode(img) : "";
      const capText = cap ? collapseInline(cap.textContent || "") : "";
      const out = `${imgMd}${capText ? `\n\n*${capText}*\n` : ""}`;
      return out ? `\n\n${out.trim()}\n\n` : "";
    }
    case "div":
    case "section":
    case "article":
    case "main":
    case "header":
    case "footer":
    case "aside":
    case "nav": {
      const text = inner.replace(/\n{2,}/g, "\n\n").trim();
      return text ? `\n\n${text}\n\n` : "";
    }
    case "span": return inner;
    case "iframe":
    case "script":
    case "style":
    case "noscript":
    case "template": return "";
    default: return inner;
  }
}

function serializeChildren(parent: Node): string {
  if (!parent || !parent.childNodes) return "";
  const parts: string[] = [];
  for (const child of Array.from(parent.childNodes)) {
    parts.push(serializeNode(child));
  }
  return parts.join("");
}

async function domToMarkdown(html: string): Promise<string> {
  const { document } = await parseBody(html);
  return serializeChildren(document.body).replace(/\n{3,}/g, "\n\n").trim();
}

/** 解析 LLM 返回的 HTML，替换占位符为已翻译文本，再走 DOM→Markdown */
async function reassembleMarkdown(translatedHtml: string): Promise<string> {
  const cleaned = stripLlmFence(translatedHtml);
  const { document } = await parseBody(cleaned);
  /*-- 容忍标记周围多余空白；闭标记的 index 数字可能被翻译时改动但通常不会 --*/
  const placeholderRe = /\[\[\s*T_(\d+)\s*\]\]([\s\S]*?)\[\[\s*\/?T_\1\s*\]\]/g;
  walkTextNodes(document.body, (textNode) => {
    const original = textNode.textContent || "";
    if (!original.includes("[[T_")) return;
    textNode.textContent = original.replace(placeholderRe, (_m, _idx, inner: string) => inner);
  });
  /*-- 兜底：清掉任何残留的孤儿占位符（LLM 改写关闭 index 时）--*/
  walkTextNodes(document.body, (textNode) => {
    const text = textNode.textContent || "";
    if (text.includes("[[T_") || text.includes("[[/T_")) {
      textNode.textContent = text.replace(/\[\[\s*\/?T_\d+\s*\]\]/g, "");
    }
  });
  return serializeChildren(document.body).replace(/\n{3,}/g, "\n\n").trim();
}

/*-- 占位翻译标记：GLM_API_KEY 缺失时 article-translation.service.mjs 的 translateText
    不会报错，而是返回带这两个前缀之一的"译文"。留着它等于把失败伪装成正常草稿 --*/
const PLACEHOLDER_MARKERS = ["[中文翻译]", "[English Translation]"];

/**
 * 判一次翻译是不是失败了。
 * translateText 的契约是"失败返回原文"（段落级失败回退原文、异常整体回退原文），所以空串与
 * 逐字相同都是同一个信号；缺 key 时还会返回占位译文，一并在这里认出来。
 * 返回失败原因，正常时返回 ""。
 */
function detectTranslationFailure(source: string, translated: string): string {
  const text = translated.trim();
  if (!text) return "译文为空";
  if (PLACEHOLDER_MARKERS.some((marker) => text.includes(marker))) {
    return "GLM_API_KEY 未配置，translateText 返回占位译文";
  }
  if (text === source.trim()) {
    return "译文与原文逐字相同（GLM 未真正返回译文，失败被 translateText 静默吞掉）";
  }
  return "";
}

/*===== 翻译：原文 → 译文 Markdown =====*/

async function translateHtmlBody(
  html: string,
  sourceLang: "zh" | "en",
  targetLang: "zh" | "en",
  onProgress: (message: string) => void
): Promise<{ translated: string; error: string }> {
  onProgress(`翻译正文 ${sourceLang} → ${targetLang}（${html.length} 字符 HTML）`);
  const { markedHtml, pairs } = await buildTranslateInput(html);
  if (pairs === 0) {
    /*-- 没有可翻译的文本节点（纯图/代码页），直接 DOM→Markdown 保留结构 --*/
    return { translated: await domToMarkdown(html), error: "" };
  }
  try {
    const llmOutput = await translateText(markedHtml, sourceLang, targetLang);
    if (llmOutput) {
      const translated = await reassembleMarkdown(llmOutput);
      const failure = detectTranslationFailure(await domToMarkdown(html), translated);
      if (failure) return { translated, error: `正文翻译失败: ${failure}` };
      return { translated, error: "" };
    }
  } catch (error) {
    return { translated: "", error: `正文翻译失败: ${errText(error)}` };
  }
  return { translated: "", error: "正文翻译失败: LLM 返回空译文" };
}

async function translateMarkdownBody(
  markdown: string,
  sourceLang: "zh" | "en",
  targetLang: "zh" | "en",
  onProgress: (message: string) => void
): Promise<{ translated: string; error: string }> {
  onProgress(`翻译正文 ${sourceLang} → ${targetLang}（${markdown.length} 字符）`);
  try {
    const translated = await translateText(markdown, sourceLang, targetLang);
    const failure = detectTranslationFailure(markdown, translated);
    if (failure) return { translated, error: `正文翻译失败: ${failure}` };
    return { translated, error: "" };
  } catch (error) {
    return { translated: "", error: `正文翻译失败: ${errText(error)}` };
  }
}

/*===== slug 派生 =====*/

/*-- 保留一切语言文字与数字（posts 的 path 允许中文，normalizeSlug 只拒 /、控制字符与
     Windows 非法字符），只把空白/斜杠/符号折叠成连字符 --*/
function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_/\\]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function slugFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments.length ? segments[segments.length - 1] : "";
    return slugify(last.replace(/\.(html?|php|aspx|jsp|mdx?)$/i, ""));
  } catch {
    return "";
  }
}

/**
 * 落点 path：同名草稿原地更新；同名已发布记录绝不覆盖——upsertEntry 是整行替换，
 * 覆盖会把一篇在架文章降成未发布的草稿，从此站点上消失。故撞已发布记录时加数字后缀。
 */
async function resolvePath(
  collection: CollectionKey,
  base: string,
  onProgress: (message: string) => void
): Promise<string> {
  const existing = await getEntry(collection, base);
  if (!existing) return base;
  if (existing.status === "draft") {
    onProgress(`同名草稿已存在，将原地更新: ${base}`);
    return base;
  }
  for (let n = 2; n <= 50; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await getEntry(collection, candidate))) {
      onProgress(`已存在同名的已发布记录，本草稿改用: ${candidate}`);
      return candidate;
    }
  }
  throw new Error(`无法为 "${base}" 找到可用的草稿 path（50 个候选均已占用）`);
}

/*===== 三种输入 → 统一原文 =====*/

interface SourceContent {
  bodyKind: IntakeBodyKind;
  /** 原文正文：html 为 Readability 产物，markdown 为原文文本 */
  body: string;
  plainText: string;
  title: string;
  description: string;
  author: string;
  coverImage: string;
  publishedTime: string;
  keywords: string[];
  sourceUrl: string;
  /** 原文链接是不是占位（file/text 输入没给 --source-url 时），用于提示而非阻断 */
  sourceUrlIsPlaceholder: boolean;
}

/*-- posts.sourceUrl 是 z.string().url() 必填。粘贴正文/上传文件通常没有外链，给一个本机
     urn 占位而不是编一个假域名：它过得了 URL 校验，也不会在站点上变成一个假外链 --*/
function placeholderSourceUrl(path: string): string {
  return `urn:blogx-x:intake:${encodeURIComponent(path)}`;
}

async function readSource(
  request: IntakeRequest,
  onProgress: (message: string) => void
): Promise<SourceContent> {
  if (request.source === "url") {
    const url = (request.url || "").trim();
    if (!url) throw new Error("source=url 时需要提供 url");
    const page = await fetchPage(url, onProgress);
    if (!page.html.trim()) throw new Error(`抓取成功但正文为空: ${url}`);
    return {
      bodyKind: "html",
      body: page.html,
      plainText: page.textContent,
      title: page.title,
      description: page.description,
      author: page.author,
      coverImage: page.coverImage,
      publishedTime: page.publishedTime,
      keywords: page.keywords,
      sourceUrl: url,
      sourceUrlIsPlaceholder: false,
    };
  }

  if (request.source === "file") {
    let filename = (request.filename || "").trim();
    let raw = typeof request.text === "string" ? request.text : "";
    if (!raw) {
      const filePath = (request.filePath || "").trim();
      if (!filePath) throw new Error("source=file 时需要 filePath（CLI）或 text（面板）");
      raw = await readFile(filePath, "utf-8");
      filename = filename || filePath.split(/[\\/]/).pop() || "";
    }
    if (!raw.trim()) throw new Error("文件内容为空");
    const isMarkdown = /\.(md|mdx|markdown)$/i.test(filename);
    const isHtml = /\.(html?|xhtml)$/i.test(filename);
    if (isHtml) {
      return {
        bodyKind: "html",
        body: raw,
        plainText: raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        title: filename.replace(/\.[^.]+$/, ""),
        description: "",
        author: "",
        coverImage: "",
        publishedTime: "",
        keywords: [],
        sourceUrl: (request.sourceUrl || "").trim(),
        sourceUrlIsPlaceholder: !(request.sourceUrl || "").trim(),
      };
    }
    const parsed = isMarkdown ? matter(raw) : { data: {} as Record<string, unknown>, content: raw };
    const data = parsed.data || {};
    const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    return {
      bodyKind: "markdown",
      body: parsed.content || raw,
      plainText: parsed.content || raw,
      title: str(data.title) || filename.replace(/\.[^.]+$/, ""),
      description: str(data.description),
      author: str(data.originalAuthor) || str(data.author),
      coverImage: str(data.coverImage),
      publishedTime: frontmatterDate(data.date),
      keywords: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string") : [],
      sourceUrl: str(data.sourceUrl) || (request.sourceUrl || "").trim(),
      sourceUrlIsPlaceholder: !str(data.sourceUrl) && !(request.sourceUrl || "").trim(),
    };
  }

  const text = typeof request.text === "string" ? request.text : "";
  if (!text.trim()) throw new Error("source=text 时需要 text（或经 stdin 提供正文）");
  return {
    bodyKind: "markdown",
    body: text,
    plainText: text,
    title: "",
    description: "",
    author: "",
    coverImage: "",
    publishedTime: "",
    keywords: [],
    sourceUrl: (request.sourceUrl || "").trim(),
    sourceUrlIsPlaceholder: !(request.sourceUrl || "").trim(),
  };
}

/*===== 主流程：输入 → 草稿记录 =====*/

export async function createIntakeDraft(
  request: IntakeRequest,
  options: IntakeOptions = {}
): Promise<IntakeDraft> {
  const write = options.write !== false;
  const onProgress = options.onProgress || (() => {});
  const warnings: string[] = [];

  const source = await readSource(request, onProgress);
  if (!source.body.trim()) throw new Error("没有可入库的原文正文");

  /*-- 语言与翻译：原文语言决定方向；检测不出按英文处理（技术内容以英文为多，且英文→中文
        是更安全的一侧），与 processArticleTranslation 的默认一致 --*/
  const detected = detectLanguage(source.plainText || source.body);
  const sourceLang: "zh" | "en" = detected === "zh" ? "zh" : "en";
  const targetLang: "zh" | "en" = sourceLang === "zh" ? "en" : "zh";

  const bodyTranslation =
    source.bodyKind === "html"
      ? await translateHtmlBody(source.body, sourceLang, targetLang, onProgress)
      : await translateMarkdownBody(source.body, sourceLang, targetLang, onProgress);
  if (bodyTranslation.error) warnings.push(bodyTranslation.error);

  /*-- frontmatter：GLM 提取优先，缺失字段回落到页面自带元数据，再回落到正文推断 --*/
  const extraction = await extractFrontmatterWithGlm(
    {
      title: source.title,
      description: source.description,
      author: source.author,
      plainText: source.plainText || source.body,
      sourceUrl: source.sourceUrl,
    },
    onProgress
  );
  if (extraction.error) warnings.push(extraction.error);

  /*-- 兜底 slug 带一段正文指纹：同一天粘贴两篇不同正文，若都叫 post-<日期>，后一篇会把
        前一篇草稿原地覆盖掉（resolvePath 的同名草稿更新规则），第一篇的粘贴内容就此无声丢失。
        带指纹后"同一份正文重复提交"仍命中同一草稿，"不同正文"各得一条。 --*/
  const bodyFingerprint = createHash("sha1")
    .update(source.plainText.trim().slice(0, 400), "utf8")
    .digest("hex")
    .slice(0, 8);
  const slugBase =
    slugFromUrl(source.sourceUrl) ||
    slugify(extraction.fields.title || source.title) ||
    slugify(request.filename || "") ||
    `post-${new Date().toISOString().slice(0, 10)}-${bodyFingerprint}`;
  const path = write ? await resolvePath(INTAKE_COLLECTION, slugBase, onProgress) : slugBase;
  const sourceUrl = source.sourceUrl || placeholderSourceUrl(path);
  if (source.sourceUrlIsPlaceholder && !source.sourceUrl) {
    warnings.push(
      `输入没有原文链接，sourceUrl 写成占位 ${sourceUrl}；发布前请在面板或 content-publish 前补一个真实 URL`
    );
  }

  const title =
    extraction.fields.title || source.title || (sourceLang === "zh" ? "未命名草稿" : "Untitled draft");
  const description =
    extraction.fields.description ||
    source.description ||
    collapseInline(source.plainText).slice(0, 160);
  const tags = extraction.fields.tags || source.keywords;
  const originalAuthor = extraction.fields.originalAuthor || source.author;
  const date = extraction.fields.date || source.publishedTime || new Date().toISOString();
  const now = new Date().toISOString();
  const translatedBody = bodyTranslation.translated || source.body;
  if (!bodyTranslation.translated) warnings.push("没有可用译文，translatedBody 暂存原文");

  const frontmatter: Record<string, unknown> = {
    sourceUrl,
    title,
    date,
    description,
    tags,
    originalAuthor,
    originalLang: sourceLang,
    /*-- isDraft 是遗留口径（glob loader 过滤用），草稿权威口径是记录的 status --*/
    isDraft: false,
    /*-- fetched 子对象的形状与 article-db 的读取契约一致：它优先读 fetched.*，读不到才回退
          到 frontmatter 顶层。缺了它，发布后的详情页拿不到作者/封面/字数 --*/
    fetched: {
      title,
      description,
      author: originalAuthor,
      coverImage: source.coverImage,
      wordCount: countWords(source.plainText),
      fetchedAt: now,
      translatedAt: bodyTranslation.translated ? now : "",
      contentHash: createHash("sha256")
        .update(`${sourceUrl}::${source.plainText.slice(0, 500)}`, "utf8")
        .digest("hex"),
      fetchStatus: "success",
    },
    /*-- intake 自述：成败与原因随草稿可见。status = failed 表示"有任何需要人工修订的警告"
          （GLM 提取/翻译失败、缺原文链接等），此时草稿照常落库，content-publish 会把它当众
          念一遍再发布——人工修订后仍可发布，所以它不是发布门禁 --*/
    intake: {
      source: request.source,
      status: warnings.length ? "failed" : "ok",
      warnings,
      at: now,
    },
  };
  if (!originalAuthor) delete frontmatter.originalAuthor;
  if (!tags.length) delete frontmatter.tags;

  const record: ContentRecord = {
    collection: INTAKE_COLLECTION,
    path,
    frontmatter: JSON.stringify(frontmatter),
    body: translatedBody,
    originalBody: source.body,
    translatedBody,
    status: "draft",
    updatedAt: now,
  };

  if (write) {
    onProgress(`写入草稿 ${INTAKE_COLLECTION}/${path}`);
    await upsertEntry(record);
  }

  return { record, frontmatter, warnings };
}

function countWords(text: string): number {
  const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  /*-- CJK 计字、拉丁计词（与 fetch-articles 的 countWords 同一算法）--*/
  const cjk = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = plain
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + latin;
}

/*===== 草稿箱 =====*/

export async function listIntakeDrafts(
  collection: CollectionKey = INTAKE_COLLECTION
): Promise<DraftSummary[]> {
  const records = await listCollection(collection);
  return records
    .filter((record) => record.status === "draft")
    .map(toDraftSummary)
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 单条记录 → 草稿摘要（面板写入后要回一条给界面，不必再查一次表） */
export function summarizeIntakeDraft(record: ContentRecord): DraftSummary {
  return toDraftSummary(record);
}

function toDraftSummary(record: ContentRecord): DraftSummary {
  const frontmatter = parseFrontmatterJson(record.frontmatter);
  const intake = frontmatter.intake;
  const intakeInfo =
    intake && typeof intake === "object" ? (intake as Record<string, unknown>) : {};
  const status = intakeInfo.status === "failed" ? "failed" : intakeInfo.status === "ok" ? "ok" : "unknown";
  const error = Array.isArray(intakeInfo.warnings)
    ? intakeInfo.warnings.filter((w): w is string => typeof w === "string").join("; ")
    : "";
  return {
    path: record.path,
    title: str(frontmatter.title) || record.path,
    description: str(frontmatter.description),
    tags: Array.isArray(frontmatter.tags)
      ? frontmatter.tags.filter((t): t is string => typeof t === "string")
      : [],
    date: str(frontmatter.date),
    originalAuthor: str(frontmatter.originalAuthor),
    sourceUrl: str(frontmatter.sourceUrl),
    originalLang: str(frontmatter.originalLang),
    intakeSource: str(intakeInfo.source),
    intakeStatus: status,
    intakeError: error,
    updatedAt: record.updatedAt,
    bodyLength: record.body.length,
    originalBodyLength: record.originalBody.length,
    translatedBodyLength: record.translatedBody.length,
  };
}

function parseFrontmatterJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function deleteIntakeDraft(
  collection: CollectionKey = INTAKE_COLLECTION,
  path: string
): Promise<void> {
  await deleteEntry(collection, path);
}

/*===== 发布：校验 → status: published → Deploy Hook =====*/

export async function publishIntakeDraft(
  collection: CollectionKey = INTAKE_COLLECTION,
  path: string,
  options: { dryRun?: boolean; onProgress?: (message: string) => void } = {}
): Promise<PublishReport> {
  const onProgress = options.onProgress || (() => {});
  const dryRun = options.dryRun === true;

  const current = await getEntry(collection, path);
  if (!current) {
    throw new Error(`草稿不存在: ${collection}/${path}`);
  }

  const frontmatter = parseFrontmatterJson(current.frontmatter);
  const validation = validateCollectionFields(collection, frontmatter);
  if (!validation.ok) {
    /*-- 逐条 issue：笼统的"校验失败"让人不知道该改哪个字段 --*/
    throw new PublishValidationError(splitIssues(validation.error));
  }

  const warnings: string[] = [];
  if (current.status !== "draft") {
    warnings.push(`该记录当前就是 ${current.status}，本次发布不改动状态`);
  }
  const intake = frontmatter.intake;
  const intakeInfo = intake && typeof intake === "object" ? (intake as Record<string, unknown>) : {};
  if (intakeInfo.status === "failed") {
    const reasons = Array.isArray(intakeInfo.warnings)
      ? intakeInfo.warnings.filter((w): w is string => typeof w === "string")
      : [];
    warnings.push(`此草稿带 intake 失败记录：${reasons.join("; ") || "原因未记录"}。确认内容无误再发布。`);
  }
  if (!current.translatedBody.trim()) {
    warnings.push("translatedBody 为空：详情页会回退渲染 body 或 Markdown 兜底内容");
  }

  if (dryRun) {
    onProgress(`--dry-run：校验通过，未改状态、未触发重建（${collection}/${path}）`);
    warnings.forEach((warning) => onProgress(`警告: ${warning}`));
    return {
      collection,
      path,
      published: false,
      frontmatter: validation.frontmatter,
      warnings,
      deployHook: { triggered: false },
    };
  }

  await setStatus(collection, path, "published");
  onProgress(`已置为 published: ${collection}/${path}`);

  const deployHook = await triggerDeployHook(onProgress);
  if (deployHook.warning) warnings.push(deployHook.warning);

  return {
    collection,
    path,
    published: true,
    frontmatter: validation.frontmatter,
    warnings,
    deployHook,
  };
}

/** content-schemas 把所有 issue 拼成一条 error 串，这里按 "; " 拆回逐条，供调用方列字段错误 */
function splitIssues(error: string): string[] {
  const detail = error.replace(/^字段校验失败（[^）]*）:\s*/, "");
  return detail
    .split("; ")
    .map((issue) => issue.trim())
    .filter(Boolean);
}

function maskDeployHook(hook: string): string {
  try {
    const parsed = new URL(hook);
    return `${parsed.host}…${hook.slice(-6)}`;
  } catch {
    return "<不是合法 URL>";
  }
}

/**
 * 触发 Vercel 重建。
 * 变量缺失 → 只警告（内容已在表里，缺的只是自动重建）；变量存在 → 非 2xx 抛错，
 * 因为"发布成功但站点没更新"是最难发现的一种失败。
 */
export async function triggerDeployHook(
  onProgress: (message: string) => void = () => {}
): Promise<{ triggered: boolean; warning?: string }> {
  const hook = (process.env[DEPLOY_HOOK_ENV] || "").trim();
  if (!hook) {
    onProgress(`警告: ${DEPLOY_HOOK_MISSING_WARNING}`);
    return { triggered: false, warning: DEPLOY_HOOK_MISSING_WARNING };
  }
  onProgress(`触发 Vercel 重建: ${maskDeployHook(hook)}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 200);
      throw new Error(
        `Deploy Hook 调用失败: HTTP ${resp.status} ${detail}。内容已置为 published 并写入 content 表，` +
          `但站点未重建，请手动部署一次或在 Vercel 控制台检查该 Hook。`
      );
    }
    onProgress("Deploy Hook 已接受，站点将在 1-2 分钟内重建");
    return { triggered: true };
  } finally {
    clearTimeout(timer);
  }
}
