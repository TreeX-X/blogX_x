#!/usr/bin/env node
/**
 * 文章抓取 + 翻译脚本
 * 构建时自动扫描 posts 目录，抓取外链文章原文并翻译
 *
 * 用法：
 *   node scripts/fetch-articles.mjs              # 仅抓取
 *   node scripts/fetch-articles.mjs --translate   # 抓取 + 翻译
 *   node scripts/fetch-articles.mjs --force       # 强制重新抓取所有
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";

dotenv.config();

/*===== 配置常量 =====*/
const POSTS_DIR = "src/content/posts";
const ARTICLES_TABLE = "articles";
const LOCAL_DB_PATH = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
const FETCH_TIMEOUT = 15_000; /*-- 15 秒超时 --*/
const TRANSLATE_BATCH_SIZE = 3000; /*-- 每段翻译最大字符数 --*/
const MAX_RETRIES = 2;
const TRANSLATE_TIMEOUT = 60_000; /*-- 翻译请求 60 秒超时 --*/
const USER_AGENT =
  "Mozilla/5.0 (compatible; BlogX_x/1.0; +https://blogx-x.vercel.app)";

/*===== 命令行参数解析 =====*/
const args = process.argv.slice(2);
const shouldTranslate = args.includes("--translate");
const forceRefetch = args.includes("--force");

/*===== 统计计数器 =====*/
const stats = { total: 0, fetched: 0, skipped: 0, failed: 0, translated: 0, translateFailed: 0 };

/*===== 工具函数 =====*/

function computeHash(url, content) {
  return crypto.createHash("sha256").update(`${url}::${content.slice(0, 500)}`, "utf8").digest("hex");
}

function countWords(text) {
  /*-- 移除 HTML 标签后统计词数（英文按空格，中文按字符） --*/
  const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const cjk = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = plain.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ").split(/\s+/).filter(Boolean).length;
  return cjk + latin;
}

function slugify(filename) {
  return filename.replace(/\.mdx?$/, "");
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/*===== LanceDB 操作 =====*/

async function getDb() {
  const dbUri = path.join(process.cwd(), LOCAL_DB_PATH);
  return lancedb.connect(dbUri);
}

async function ensureTable(db) {
  const tableNames = await db.tableNames();
  if (tableNames.includes(ARTICLES_TABLE)) {
    return db.openTable(ARTICLES_TABLE);
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
      /*-- 尝试从原始 HTML 提取 og:image 和 author --*/
      coverImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "",
      author: document.querySelector('meta[name="author"]')?.getAttribute("content") || parsed.byline || "",
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/*===== LLM 翻译 =====*/

const TRANSLATE_SYSTEM_PROMPT = `你是一位专业的技术文章翻译者。请将以下技术文章翻译为中文。
规则：
1. 保留所有代码块（\`\`\`...\`\`\`）原样不翻译
2. 保留所有行内代码（\`...\`）原样不翻译
3. 保留所有链接 URL 不翻译，但翻译链接文字
4. 保留所有图片 URL 不翻译
5. 技术术语首次出现时用「中文（English）」格式，后续直接用中文
6. 保持原文的段落结构和 Markdown 格式
7. 翻译要自然流畅，不要生硬直译
8. 直接输出翻译结果，不要添加任何解释`;

async function translateText(text) {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ GLM_API_KEY 未配置，跳过翻译");
    return null;
  }

  const baseUrl = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
  const model = process.env.GLM_MODEL || "glm-4.5-air";

  /*-- 长文分段翻译 --*/
  const segments = splitTextIntoSegments(text, TRANSLATE_BATCH_SIZE);
  const translatedSegments = [];
  if (segments.length > 1) console.log(`     共 ${segments.length} 个段落待翻译...`);

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    let translated = null;
    if (segments.length > 1) console.log(`     📝 翻译段落 ${i + 1}/${segments.length} (${segment.length} 字符)...`);

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      try {
        const _ctrl = new AbortController();
        const _tmr = setTimeout(() => _ctrl.abort(), TRANSLATE_TIMEOUT);
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
              { role: "system", content: TRANSLATE_SYSTEM_PROMPT },
              { role: "user", content: segment },
            ],
            temperature: 0.3,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${errText}`);
        }

        clearTimeout(_tmr);
        const data = await resp.json();
        translated = data.choices?.[0]?.message?.content || "";
        break;
      } catch (err) {
        clearTimeout(_tmr);
        if (retry < MAX_RETRIES) {
          const wait = 1000 * Math.pow(2, retry);
          console.warn(`  ⚠️ 翻译段落 ${i + 1} 失败 (${retry + 1}/${MAX_RETRIES}): ${err.message}，${wait}ms 后重试...`);
          await new Promise((r) => setTimeout(r, wait));
        } else {
          console.error(`  ❌ 翻译段落 ${i + 1} 最终失败: ${err.message}`);
        }
      }
    }

    translatedSegments.push(translated || segment);
  }

  return translatedSegments.join("\n\n");
}

/**
 * 将长文本按段落边界切分为不超 maxLen 的段
 */
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

/*===== 主流程 =====*/

async function main() {
  console.log("📦 文章抓取脚本启动...");
  console.log(`   模式: ${shouldTranslate ? "抓取 + 翻译" : "仅抓取"}${forceRefetch ? " (强制刷新)" : ""}`);

  /*-- 1. 扫描 posts 目录 --*/
  if (!fs.existsSync(POSTS_DIR)) {
    console.log("⚠️ posts 目录不存在，跳过");
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
    console.log("ℹ️ 没有找到带 sourceUrl 的文章，跳过");
    return;
  }
  console.log(`📋 发现 ${articles.length} 篇外链文章`);

  /*-- 2. 连接 LanceDB --*/
  const db = await getDb();
  const table = await ensureTable(db);

  /*-- 3. 逐篇处理 --*/
  for (const article of articles) {
    const { slug, data } = article;
    const url = data.sourceUrl;
    const existing = await getExistingRecord(table, slug);

    /*-- 检查是否需要重新抓取 --*/
    if (!forceRefetch && existing && existing.fetchStatus === "success" && existing.originalContent) {
      console.log(`  ⏭️ ${slug} — 已有缓存，跳过抓取`);
      stats.skipped++;
      /*-- 如果需要翻译但尚未翻译，继续翻译 --*/
      if (shouldTranslate && (!existing.translatedContent || existing.translatedContent === "")) {
        await doTranslate(table, existing, slug);
      }
      continue;
    }

    /*-- 抓取 --*/
    console.log(`  🔍 抓取 ${slug} — ${extractDomain(url)}`);
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
        originalLang: data.originalLang || "en",
        title: result.title || data.title || slug,
        description: result.excerpt || data.description || "",
        author: result.author || data.originalAuthor || "",
        coverImage: result.coverImage || data.coverImage || "",
        wordCount,
        fetchStatus: "success",
      };

      await upsertRecord(table, record);
      console.log(`  ✅ ${slug} — 抓取成功 (${wordCount} 词)`);
      stats.fetched++;

      /*-- 翻译 --*/
      if (shouldTranslate) {
        await doTranslate(table, record, slug);
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
        originalLang: data.originalLang || "en",
        title: data.title || slug,
        description: data.description || "",
        author: data.originalAuthor || "",
        coverImage: data.coverImage || "",
        wordCount: 0,
        fetchStatus: "failed",
      };
      await upsertRecord(table, failedRecord);
      console.log(`  ❌ ${slug} — 抓取失败: ${err.message}`);
      stats.failed++;
    }
  }

  /*-- 4. 输出报告 --*/
  console.log("\n📊 抓取报告:");
  console.log(`   总计: ${stats.total} | 成功: ${stats.fetched} | 跳过: ${stats.skipped} | 失败: ${stats.failed}`);
  if (shouldTranslate) {
    console.log(`   翻译成功: ${stats.translated} | 翻译失败: ${stats.translateFailed}`);
  }
}

/**
 * 对单条记录执行翻译
 */
async function doTranslate(table, record, slug) {
  if (!record.originalContent) {
    console.log(`  ⚠️ ${slug} — 无原文内容，跳过翻译`);
    return;
  }
  console.log(`  🌐 翻译 ${slug}...`);
  const plainText = record.originalContent.replace(/<[^>]+>/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const translated = await translateText(plainText);
  if (translated) {
    record.translatedContent = translated;
    record.translatedAt = new Date().toISOString();
    await upsertRecord(table, record);
    console.log(`  ✅ ${slug} — 翻译完成`);
    stats.translated++;
  } else {
    console.log(`  ❌ ${slug} — 翻译失败`);
    stats.translateFailed++;
  }
}

main().catch((err) => {
  console.error("💥 脚本执行失败:", err);
  process.exit(1);
});
