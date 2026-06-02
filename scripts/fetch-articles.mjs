#!/usr/bin/env node
/**
 * 文章抓取 + 翻译脚本
 * 构建时自动扫描 posts 目录，抓取外链文章原文并翻译
 *
 * 用法：
 *   node scripts/fetch-articles.mjs              # 仅抓取
 *   node scripts/fetch-articles.mjs --translate   # 抓取 + 翻译（仅新文章）
 *   node scripts/fetch-articles.mjs --force       # 强制重新抓取所有
 *   node scripts/fetch-articles.mjs --translate --force  # 强制重新抓取并翻译
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";

dotenv.config();

const log = new Logger("fetch-articles");

/*===== 配置常量 =====*/
const POSTS_DIR = "src/content/posts";
const ARTICLES_TABLE = "articles";
const LOCAL_DB_PATH = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
const FETCH_TIMEOUT = 15_000;
const TRANSLATE_BATCH_SIZE = 3000;
const MAX_RETRIES = 2;
const TRANSLATE_TIMEOUT = 60_000;
const USER_AGENT = "Mozilla/5.0 (compatible; BlogX_x/1.0; +https://blogx-x.vercel.app)";

/*===== 命令行参数解析 =====*/
const args = process.argv.slice(2);
const shouldTranslate = args.includes("--translate");
const forceRefetch = args.includes("--force");

/*===== 统计计数器 =====*/
const stats = {
  total: 0,
  fetched: 0,
  skipped: 0,
  failed: 0,
  translated: 0,
  translateSkipped: 0,
  translateFailed: 0
};

/*===== 工具函数 =====*/

function computeHash(url, content) {
  return crypto.createHash("sha256").update(`${url}::${content.slice(0, 500)}`, "utf8").digest("hex");
}

function countWords(text) {
  const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const cjk = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = plain.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ").split(/\s+/).filter(Boolean).length;
  return cjk + latin;
}

function slugify(filename) {
  return filename.replace(/\.mdx?$/, "");
}

function stripHtmlToMarkdownFallback(html) {
  return String(html || "")
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => `\n\n\`\`\`\n${code}\n\`\`\`\n\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function writeArticleMarkdown(filePath, data, body) {
  const normalizedBody = String(body || "").trim();
  const fileContent = matter.stringify(`${normalizedBody}\n`, data);
  fs.writeFileSync(filePath, fileContent, "utf-8");
}

function hasMeaningfulBody(body) {
  return typeof body === "string" && body.trim().length > 0;
}

function syncMarkdownFromRecord(filePath, data, record) {
  if (!record) return false;
  const preferredBody = record.translatedContent || stripHtmlToMarkdownFallback(record.originalContent);
  if (!hasMeaningfulBody(preferredBody)) return false;
  writeArticleMarkdown(filePath, data, preferredBody);
  return true;
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/*-- 通过 CJK 字符占比判断源语言：>15% 视为中文，否则视为英文；未知默认 en 并 warn --*/
function detectSourceLang(htmlOrText) {
  const stripped = String(htmlOrText || "").replace(/<[^>]+>/g, " ");
  if (!stripped.trim()) {
    log.warn("源语言识别: 文本为空，默认按 en 处理");
    return "en";
  }
  const cjkChars = (stripped.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const totalChars = stripped.replace(/\s+/g, "").length;
  if (totalChars === 0) {
    log.warn("源语言识别: 无可见字符，默认按 en 处理");
    return "en";
  }
  const ratio = cjkChars / totalChars;
  if (ratio > 0.15) return "zh";
  if (ratio === 0) return "en";
  log.warn(`源语言识别: CJK 比例 ${(ratio * 100).toFixed(1)}% 处于边界，默认按 en 处理`);
  return "en";
}

/*===== LanceDB 操作 =====*/

async function getDb() {
  const { LANCEDB_URI, LANCEDB_API_KEY } = process.env;

  /*-- 优先尝试 LanceDB Cloud --*/
  if (LANCEDB_URI && LANCEDB_API_KEY) {
    try {
      log.database("连接 LanceDB Cloud...");
      const db = await lancedb.connect(LANCEDB_URI, { apiKey: LANCEDB_API_KEY });
      log.success("LanceDB Cloud 连接成功");
      return db;
    } catch (error) {
      log.warn(`LanceDB Cloud 连接失败，降级到本地: ${error.message}`);
    }
  }

  /*-- 降级到本地 LanceDB --*/
  log.database("使用本地 LanceDB...");
  const dbUri = path.join(process.cwd(), LOCAL_DB_PATH);
  return lancedb.connect(dbUri);
}

async function ensureTable(db) {
  const tableNames = await db.tableNames();
  if (tableNames.includes(ARTICLES_TABLE)) {
    try {
      const table = await db.openTable(ARTICLES_TABLE);
      await table.query().limit(1).toArray();
      return table;
    } catch (error) {
      log.warn(`articles 表损坏，正在重建: ${error.message}`);
      try { await db.dropTable(ARTICLES_TABLE); } catch { /* ignore */ }
    }
  }
  const table = await db.createTable(ARTICLES_TABLE, [{
    slug: "__placeholder__", sourceUrl: "", originalContent: "", translatedContent: "",
    contentHash: "", fetchedAt: "", translatedAt: "", originalLang: "en",
    title: "", description: "", author: "", coverImage: "", wordCount: 0, fetchStatus: "pending",
  }]);
  await table.delete('slug = "__placeholder__"');
  return table;
}

async function getExistingRecord(table, slug) {
  try {
    const rows = await table.query().where(`slug = "${slug}"`).limit(1).toArray();
    return rows.length > 0 ? rows[0] : null;
  } catch { return null; }
}

async function upsertRecord(table, record) {
  try { await table.delete(`slug = "${record.slug}"`); } catch { /* empty table */ }
  await table.add([record]);
}

/*===== 网页抓取 =====*/

async function fetchArticle(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const { document } = parseHTML(html);
    const reader = new Readability(document);
    const parsed = reader.parse();
    if (!parsed || !parsed.textContent?.trim()) throw new Error("Readability 解析失败");
    return {
      title: parsed.title || "",
      content: parsed.content || "",
      textContent: parsed.textContent || "",
      excerpt: parsed.excerpt || "",
      coverImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "",
      author: document.querySelector('meta[name="author"]')?.getAttribute("content") || parsed.byline || "",
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/*===== LLM 翻译 =====*/

/*-- 英文 → 中文 的翻译 prompt：保留 HTML 标签、占位符、URL、代码块不翻译 --*/
const TRANSLATE_SYSTEM_PROMPT_EN_TO_ZH = `你是一位专业的技术文章翻译者。请将以下技术文章翻译为中文（中文）。
规则：
1. 保留所有代码块（\`\`\`...\`\`\`）原样不翻译
2. 保留所有行内代码（\`...\`）原样不翻译
3. 保留所有链接 URL 不翻译，但翻译链接文字
4. 保留所有图片 URL 不翻译
5. 技术术语首次出现时用「中文（English）」格式，后续直接用中文
6. 保持原文的段落结构和 Markdown 格式
7. 翻译要自然流畅，不要生硬直译
8. 直接输出翻译结果，不要添加任何解释
9. 严格保留所有 HTML 标签（<p>、<h1>、<a>、<img>、<pre>、<code>、<ul>、<ol>、<li>、<blockquote> 等）的尖括号、属性名、属性值（包括 src / href / class / alt 等）
10. 严格保留所有占位符 \`[[T_N]]\` 和 \`[[/T_N]]\`（N 为数字）原样不动，只翻译它们**内部**的文本内容
11. 不要新增、删除、改写任何标签、URL、属性或占位符标记`;

/*-- 中文 → 英文 的翻译 prompt：镜像 EN→ZH 规则，但目标语言为 English --*/
const TRANSLATE_SYSTEM_PROMPT_ZH_TO_EN = `You are a professional technical article translator. Please translate the following technical article into English.
Rules:
1. Keep all code blocks (\`\`\`...\`\`\`\`) untranslated
2. Keep all inline code (\`...\`\`) untranslated
3. Keep all link URLs untranslated, but translate the link text
4. Keep all image URLs untranslated
5. For technical terms that have a well-known English name, keep the English name; on first occurrence, format as \`English (中文)\`, afterwards use English only
6. Preserve the original paragraph structure and Markdown formatting
7. Translate naturally and fluently, do not word-for-word literally
8. Output the translation directly without any explanation
9. Strictly preserve all HTML tags (<p>, <h1>, <a>, <img>, <pre>, <code>, <ul>, <ol>, <li>, <blockquote>, etc.) and their attribute names/values (src / href / class / alt, etc.) exactly as they appear
10. Strictly preserve all placeholders \`[[T_N]]\` and \`[[/T_N]]\` (N is a number) exactly as they appear; only translate the text content **between** them
11. Do not add, remove, or rewrite any tag, URL, attribute, or placeholder marker`;

/*-- 根据源语言挑选对应的 system prompt；未知语言默认按 EN→ZH 处理 --*/
function pickTranslateSystemPrompt(sourceLang) {
  return sourceLang === "zh" ? TRANSLATE_SYSTEM_PROMPT_ZH_TO_EN : TRANSLATE_SYSTEM_PROMPT_EN_TO_ZH;
}

async function translateText(text, sourceLang = "en") {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    log.warn("GLM_API_KEY 未配置，跳过翻译");
    return null;
  }

  const baseUrl = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
  const model = process.env.GLM_MODEL || "glm-4.5-air";
  const systemPrompt = pickTranslateSystemPrompt(sourceLang);

  const segments = splitTextIntoSegments(text, TRANSLATE_BATCH_SIZE);
  const translatedSegments = [];
  if (segments.length > 1) log.process(`共 ${segments.length} 个段落待翻译...`);

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    let translated = null;
    if (segments.length > 1) log.process(`翻译段落 ${i + 1}/${segments.length} (${segment.length} 字符)...`);

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      const _ctrl = new AbortController();
      const _tmr = setTimeout(() => _ctrl.abort(), TRANSLATE_TIMEOUT);
      try {
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: _ctrl.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: segment },
            ],
            temperature: 0.3,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${errText}`);
        }

        const data = await resp.json();
        translated = data.choices?.[0]?.message?.content || "";
        break;
      } catch (err) {
        if (retry < MAX_RETRIES) {
          const wait = 1000 * Math.pow(2, retry);
          log.warn(`翻译段落 ${i + 1} 失败 (${retry + 1}/${MAX_RETRIES}): ${err.message}，${wait}ms 后重试...`);
          await new Promise((r) => setTimeout(r, wait));
        } else {
          log.error(`翻译段落 ${i + 1} 最终失败: ${err.message}`);
        }
      } finally {
        clearTimeout(_tmr);
      }
    }

    translatedSegments.push(translated || segment);
  }

  return translatedSegments.join("\n\n");
}

function splitTextIntoSegments(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const segments = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";
  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxLen && current.length > 0) {
      segments.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + para;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

/*===== 富媒体翻译辅助（按文本节点分段、保留 HTML 结构）===== */

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/*-- 深度优先遍历 root 下的所有文本节点，回调收到 textNode --*/
function walkTextNodes(root, callback) {
  if (!root || !root.childNodes) return;
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
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

/*-- 将 Readability 输出的 HTML 片段用 linkedom 解析，并对每个非空文本节点插入占位符 --*/
function buildTranslateInput(html) {
  const wrapped = `<!DOCTYPE html><html><body>${html || ""}</body></html>`;
  const { document } = parseHTML(wrapped);
  const body = document.body;
  const pairs = [];
  let idx = 0;
  walkTextNodes(body, (textNode) => {
    const raw = textNode.textContent || "";
    if (!raw.trim()) return; /*-- 跳过纯空白文本节点 --*/
    pairs.push({ index: idx, originalText: raw });
    textNode.textContent = `[[T_${idx}]]${raw}[[/T_${idx}]]`;
    idx += 1;
  });
  return { markedHtml: body.innerHTML, pairs };
}

/*-- 去掉 LLM 偶尔会包裹的 ```html ... ``` 代码栅栏 --*/
function stripLlmFence(content) {
  const s = String(content || "").trim();
  const m = s.match(/^```(?:html|HTML)?\s*\n([\s\S]*?)\n```\s*$/);
  return m ? m[1] : s;
}

/*-- 折叠多余空白为单个空格，保留单个换行 --*/
function collapseInline(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

/*-- 最小 Markdown 转义：避免 alt/text 含 ] 或换行导致图片/链接语法 malformed --*/
function mdEscape(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\n/g, " ");
}

/*-- 递归序列化节点为 Markdown --*/
function serializeNode(node) {
  if (!node) return "";
  if (node.nodeType === TEXT_NODE) {
    return node.textContent || "";
  }
  if (node.nodeType !== ELEMENT_NODE) return "";
  const tag = (node.tagName || "").toLowerCase();
  const inner = serializeChildren(node);
  switch (tag) {
    case "h1": return `\n\n# ${collapseInline(inner)}\n\n`;
    case "h2": return `\n\n## ${collapseInline(inner)}\n\n`;
    case "h3": return `\n\n### ${collapseInline(inner)}\n\n`;
    case "h4": return `\n\n#### ${collapseInline(inner)}\n\n`;
    case "h5": return `\n\n##### ${collapseInline(inner)}\n\n`;
    case "h6": return `\n\n###### ${collapseInline(inner)}\n\n`;
    case "p": {
      const t = inner.replace(/\n{2,}/g, "\n").trim();
      return t ? `\n\n${t}\n\n` : "";
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
      /*-- <pre><code> 由 pre 节点处理；此处是行内 code --*/
      const parentTag = node.parentNode && (node.parentNode.tagName || "").toLowerCase();
      if (parentTag === "pre") return inner;
      return `\`${inner}\``;
    }
    case "pre": {
      const codeEl = node.querySelector ? node.querySelector("code") : null;
      const cls = codeEl && codeEl.getAttribute ? (codeEl.getAttribute("class") || "") : "";
      const langMatch = cls.match(/(?:^|\s)language-([\w+-]+)/i) || cls.match(/(?:^|\s)lang-([\w+-]+)/i);
      const lang = langMatch ? langMatch[1] : "";
      const code = codeEl ? serializeChildren(codeEl) : inner;
      /*-- 仅剥最多 1 个首尾换行（HTML 格式产生），保留代码块内含的换行 --*/
      const cleaned = code.replace(/^\n|\n$/, "");
      return `\n\n\`\`\`${lang}\n${cleaned}\n\`\`\`\n\n`;
    }
    case "blockquote": {
      const stripped = inner.replace(/\n{3,}/g, "\n\n").trim();
      const quoted = stripped.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
      return quoted ? `\n\n${quoted}\n\n` : "";
    }
    case "ul":
    case "ol": {
      const children = Array.from(node.children || []);
      const lines = [];
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
    case "a": {
      const href = (node.getAttribute && node.getAttribute("href")) || "";
      return `[${mdEscape(inner)}](${mdEscape(href)})`;
    }
    case "img": {
      const src = (node.getAttribute && node.getAttribute("src")) || "";
      const alt = (node.getAttribute && node.getAttribute("alt")) || "";
      return `![${mdEscape(alt)}](${src})`;
    }
    case "video": {
      /*-- 保留 <video src> 或内嵌 <source src> 的 URL，避免回退到原文 URL 的逻辑失效 --*/
      const src = (node.getAttribute && node.getAttribute("src")) || "";
      const innerSrc = (() => {
        const source = node.querySelector ? node.querySelector("source") : null;
        return (source && source.getAttribute && source.getAttribute("src")) || "";
      })();
      const finalSrc = src || innerSrc;
      return finalSrc ? `\n\n[video](${finalSrc})\n\n` : "";
    }
    case "picture": {
      const img = node.querySelector ? node.querySelector("img") : null;
      return img ? serializeNode(img) : "";
    }
    case "figure": {
      const img = node.querySelector ? node.querySelector("img") : null;
      const cap = node.querySelector ? node.querySelector("figcaption") : null;
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
      const t = inner.replace(/\n{2,}/g, "\n\n").trim();
      return t ? `\n\n${t}\n\n` : "";
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

function serializeChildren(parent) {
  if (!parent || !parent.childNodes) return "";
  const parts = [];
  for (const child of Array.from(parent.childNodes)) {
    parts.push(serializeNode(child));
  }
  return parts.join("");
}

/*-- 将 DOM 树序列化为最终 Markdown --*/
function domToMarkdown(document) {
  const md = serializeChildren(document && document.body).replace(/\n{3,}/g, "\n\n").trim();
  return md;
}

/*-- 解析 LLM 返回的 HTML，替换占位符为已翻译文本，再走 DOM→Markdown --*/
function reassembleMarkdown(translatedHtml) {
  const cleaned = stripLlmFence(translatedHtml);
  const wrapped = `<!DOCTYPE html><html><body>${cleaned}</body></html>`;
  const { document } = parseHTML(wrapped);
  /*-- 容忍标记周围多余空白；闭标记的 index 数字可能被翻译时改动但通常不会 --*/
  const placeholderRe = /\[\[\s*T_(\d+)\s*\]\]([\s\S]*?)\[\[\s*\/?T_\1\s*\]\]/g;
  walkTextNodes(document.body, (textNode) => {
    const original = textNode.textContent || "";
    if (!original.includes("[[T_")) return;
    textNode.textContent = original.replace(placeholderRe, (_m, _idx, inner) => inner);
  });
  /*-- 兜底：清掉任何残留的孤儿占位符（LLM 改写关闭 index 时）--*/
  walkTextNodes(document.body, (textNode) => {
    const t = textNode.textContent || "";
    if (t.includes("[[T_") || t.includes("[[/T_")) {
      textNode.textContent = t.replace(/\[\[\s*\/?T_\d+\s*\]\]/g, "");
    }
  });
  return domToMarkdown(document);
}

/*===== 翻译判断逻辑 =====*/

function shouldTranslateArticle(existing, newContent) {
  // 1. 没有翻译记录 -> 需要翻译
  if (!existing || !existing.translatedContent || existing.translatedContent === "") {
    return { needed: true, reason: "无翻译记录" };
  }

  // 2. 内容哈希变化 -> 需要重新翻译
  if (existing.contentHash && existing.contentHash !== newContent.contentHash) {
    return { needed: true, reason: "内容已更新" };
  }

  // 3. 翻译时间早于抓取时间 -> 需要重新翻译
  if (existing.translatedAt && existing.fetchedAt &&
    new Date(existing.translatedAt) < new Date(existing.fetchedAt)) {
    return { needed: true, reason: "翻译版本过旧" };
  }

  return { needed: false, reason: "翻译已是最新" };
}

/*===== 主流程 =====*/

async function main() {
  log.start("文章抓取脚本启动");
  log.config(`模式: ${shouldTranslate ? "抓取 + 翻译" : "仅抓取"}${forceRefetch ? " (强制刷新)" : ""}`);

  /*-- 1. 扫描 posts 目录 --*/
  if (!fs.existsSync(POSTS_DIR)) {
    log.warn("posts 目录不存在，跳过");
    return;
  }

  const mdFiles = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
  const articles = [];

  for (const file of mdFiles) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
    const { data } = matter(raw);
    if (!data.sourceUrl) continue;
    articles.push({ file, slug: slugify(file), data });
  }

  stats.total = articles.length;
  if (articles.length === 0) {
    log.info("没有找到带 sourceUrl 的文章，跳过");
    return;
  }
  log.info(`发现 ${articles.length} 篇外链文章`);

  /*-- 2. 连接 LanceDB --*/
  const db = await getDb();
  const table = await ensureTable(db);
  log.database("数据库连接成功");

  /*-- 3. 逐篇处理 --*/
  for (let idx = 0; idx < articles.length; idx++) {
    const article = articles[idx];
    const { slug, data } = article;
    const markdownPath = path.join(POSTS_DIR, article.file);
    log.process(`[${idx + 1}/${articles.length}] ${slug}`);
    const url = data.sourceUrl;
    const existing = await getExistingRecord(table, slug);

    /*-- 检查是否需要重新抓取 --*/
    if (!forceRefetch && existing && existing.fetchStatus === "success" && existing.originalContent) {
      /*-- 命中缓存时也要把正文补回 Markdown，避免本地文件仍为空 --*/
      const rawMarkdown = fs.readFileSync(markdownPath, "utf-8");
      const parsedMarkdown = matter(rawMarkdown);
      if (!hasMeaningfulBody(parsedMarkdown.content)) {
        if (syncMarkdownFromRecord(markdownPath, parsedMarkdown.data, existing)) {
          log.save(`${slug} — 已从缓存回写正文到 Markdown`);
        }
      }

      // 检查是否需要翻译
      if (shouldTranslate) {
        const translateCheck = shouldTranslateArticle(existing, { contentHash: existing.contentHash });
        if (translateCheck.needed) {
          log.translate(`${slug} — ${translateCheck.reason}`);
          await doTranslate(table, existing, slug);
        } else {
          log.skip(`${slug} — 已有缓存，翻译已是最新`);
          stats.translateSkipped++;
        }
      } else {
        log.skip(`${slug} — 已有缓存，跳过抓取`);
      }
      stats.skipped++;
      continue;
    }

    /*-- 抓取 --*/
    log.search(`${slug} — ${extractDomain(url)}`);
    try {
      const result = await fetchArticle(url);
      const contentHash = computeHash(url, result.textContent);
      const wordCount = countWords(result.textContent);
      const now = new Date().toISOString();

      const record = {
        slug,
        sourceUrl: url,
        originalContent: result.content,
        translatedContent: existing?.translatedContent || "",
        contentHash,
        fetchedAt: now,
        translatedAt: existing?.translatedAt || "",
        originalLang: data.originalLang || detectSourceLang(result.textContent || result.content),
        title: result.title || data.title || slug,
        description: result.excerpt || data.description || "",
        author: result.author || data.originalAuthor || "",
        coverImage: result.coverImage || data.coverImage || "",
        wordCount,
        fetchStatus: "success",
      };

      await upsertRecord(table, record);
      /*-- 将抓取正文回写到 Markdown，避免线上依赖远程 LanceDB 才能渲染文章 --*/
      /*-- 把检测到的 originalLang 合并进 frontmatter，避免新文章缺字段 / 旧文章陈旧 --*/
      const mergedData = { ...data, originalLang: record.originalLang };
      syncMarkdownFromRecord(markdownPath, mergedData, record);
      log.success(`${slug} — 抓取成功 (${wordCount} 词)`);
      stats.fetched++;

      /*-- 翻译 --*/
      if (shouldTranslate) {
        const translateCheck = shouldTranslateArticle(existing, { contentHash });
        if (translateCheck.needed) {
          log.translate(`${slug} — ${translateCheck.reason}`);
          await doTranslate(table, record, slug);
        } else {
          log.skip(`${slug} — 翻译已是最新，跳过`);
          stats.translateSkipped++;
        }
      }
    } catch (err) {
      const now = new Date().toISOString();
      const failedRecord = {
        slug,
        sourceUrl: url,
        originalContent: "",
        translatedContent: existing?.translatedContent || "",
        contentHash: "",
        fetchedAt: now,
        translatedAt: "",
        originalLang: data.originalLang || detectSourceLang(`${data.title || ""} ${data.description || ""}`),
        title: data.title || slug,
        description: data.description || "",
        author: data.originalAuthor || "",
        coverImage: data.coverImage || "",
        wordCount: 0,
        fetchStatus: "failed",
      };
      await upsertRecord(table, failedRecord);
      log.error(`${slug} — 抓取失败: ${err.message}`);
      stats.failed++;
    }
  }

  /*-- 4. 输出报告 --*/
  log.summary({
    "总计": stats.total,
    "抓取成功": stats.fetched,
    "跳过": stats.skipped,
    "抓取失败": stats.failed,
    ...(shouldTranslate ? {
      "翻译成功": stats.translated,
      "翻译跳过": stats.translateSkipped,
      "翻译失败": stats.translateFailed,
    } : {})
  });
}

/**
 * 对单条记录执行翻译
 * 新流程：先按 HTML 文本节点分段并插入占位符 → LLM 翻译 → 占位符回填 → DOM→Markdown
 * 任意一步异常时回退到原"剥标签纯文本"路径，保证已有文章不被打断
 */
async function doTranslate(table, record, slug) {
  if (!record.originalContent) {
    log.warn(`${slug} — 无原文内容，跳过翻译`);
    return;
  }

  log.translate(`${slug} — 开始翻译...`);
  /*-- Defect 4: 根据原始语言动态决定翻译方向，传入 translateText 选取对应 prompt --*/
  const sourceLang = record.originalLang || detectSourceLang(record.originalContent);
  const targetLang = sourceLang === "en" ? "zh" : "en";
  log.process(`${slug} — 源语言=${sourceLang}，目标语言=${targetLang}，待翻译 ${record.originalContent.length} 字符 HTML`);

  let translated = null;
  let usedFallback = false;
  try {
    const { markedHtml, pairs } = buildTranslateInput(record.originalContent);
    if (pairs.length === 0) {
      /*-- 没有可翻译的文本节点，直接走 DOM→Markdown，保留图片/链接/代码块结构 --*/
      log.process(`${slug} — 无可翻译文本节点，直接转 Markdown`);
      translated = reassembleMarkdown(record.originalContent);
    } else {
      const llmOutput = await translateText(markedHtml, sourceLang);
      if (llmOutput) {
        translated = reassembleMarkdown(llmOutput);
      }
    }
  } catch (err) {
    log.warn(`${slug} — 富媒体翻译流程失败，回退到纯文本翻译: ${err.message}`);
    usedFallback = true;
  }

  /*-- 兜底：旧 plain-text 路径，仅在 LLM 走通但转换失败 / 异常时使用 --*/
  if (!translated && !usedFallback) {
    log.warn(`${slug} — 翻译产物为空，回退到纯文本翻译`);
    usedFallback = true;
  }
  if (usedFallback) {
    const plainText = record.originalContent
      .replace(/<[^>]+>/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    translated = await translateText(plainText, sourceLang);
  }

  if (translated) {
    record.translatedContent = translated;
    record.translatedAt = new Date().toISOString();
    /*-- 同步修正 originalLang，避免历史记录把 unknown 状态写回 --*/
    record.originalLang = sourceLang;
    await upsertRecord(table, record);
    /*-- 翻译成功后优先把翻译正文回写到 Markdown，作为稳定的部署兜底内容 --*/
    const markdownPath = path.join(POSTS_DIR, `${slug}.md`);
    if (fs.existsSync(markdownPath)) {
      const raw = fs.readFileSync(markdownPath, "utf-8");
      const parsed = matter(raw);
      /*-- 修正 frontmatter 的 originalLang，与 record.originalLang 保持一致 --*/
      writeArticleMarkdown(markdownPath, { ...parsed.data, originalLang: sourceLang }, translated);
    }
    log.success(`${slug} — 翻译完成 (${usedFallback ? "fallback" : "html-aware"})`);
    stats.translated++;
  } else {
    log.error(`${slug} — 翻译失败`);
    stats.translateFailed++;
  }
}

main().catch((err) => {
  log.error(`脚本执行失败: ${err.message}`);
  process.exit(1);
});
