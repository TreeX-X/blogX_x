/**
 * LanceDB 文章存储工具
 * 负责从 LanceDB 读取/写入抓取的文章原文和翻译
 * 支持文章翻译功能：语言检测、翻译存储和双语内容检索
 *
 * Note: 文章正文真源为 content 表（双语正文并入 posts 记录），getArticleBySlug 改查该表；
 * articles 表保留为迁移期只读回退，验证后废弃 — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 */
import crypto from "node:crypto";
import path from "node:path";
import { getEntry } from "./content-store";

/*-- 动态导入 LanceDB，避免原生模块在不兼容环境（如 Vercel serverless）下崩溃整个页面 --*/
let lancedb: typeof import("@lancedb/lancedb") | null = null;
let lancedbLoadFailed = false;

async function loadLancedb() {
  if (lancedb) return lancedb;
  if (lancedbLoadFailed) return null;
  try {
    lancedb = await import("@lancedb/lancedb");
    return lancedb;
  } catch (error) {
    lancedbLoadFailed = true;
    console.error(`[article-db] LanceDB 原生模块加载失败: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/*-- LanceDB articles 表的记录类型 --*/
export interface ArticleRecord {
  slug: string;
  sourceUrl: string;
  originalContent: string;
  translatedContent: string;
  contentHash: string;
  fetchedAt: string;
  translatedAt: string;
  originalLang: string;
  title: string;
  description: string;
  author: string;
  coverImage: string;
  wordCount: number;
  fetchStatus: "success" | "failed" | "pending";
}

/*-- 表名常量 --*/
const ARTICLES_TABLE = "articles";

/*-- 数据库连接缓存 --*/
let dbInstance: any = null;

/**
 * 获取数据库连接（单例模式）
 * 优先连接 LanceDB Cloud（5 秒超时），失败时返回 null（不降级到本地，避免 Vercel 上挂起）
 */
async function getDb() {
  if (dbInstance) return dbInstance;

  const lib = await loadLancedb();
  if (!lib) {
    console.error('[article-db] LanceDB 模块不可用，无法建立连接');
    return null;
  }

  const { LANCEDB_URI, LANCEDB_API_KEY } = process.env;

  /*-- 优先尝试 LanceDB Cloud（带 5 秒超时） --*/
  if (LANCEDB_URI && LANCEDB_API_KEY) {
    try {
      console.log('[article-db] 尝试连接 LanceDB Cloud...');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LanceDB Cloud 连接超时 (5s)')), 5000)
      );
      dbInstance = await Promise.race([
        lib.connect(LANCEDB_URI, { apiKey: LANCEDB_API_KEY }),
        timeoutPromise,
      ]);
      console.log('[article-db] LanceDB Cloud 连接成功');
      return dbInstance;
    } catch (error) {
      console.error(`[article-db] LanceDB Cloud 连接失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.warn('[article-db] LANCEDB_URI 或 LANCEDB_API_KEY 未设置');
  }

  /*-- 与抓取脚本保持一致：Cloud 失败时降级到本地 LanceDB，避免读写策略不一致 --*/
  try {
    const localDbPath = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
    const localDbUri = path.join(process.cwd(), localDbPath);
    console.warn(`[article-db] 降级到本地 LanceDB: ${localDbUri}`);
    dbInstance = await lib.connect(localDbUri);
    return dbInstance;
  } catch (error) {
    console.error(`[article-db] 本地 LanceDB 连接失败: ${error instanceof Error ? error.message : String(error)}`);
    console.error('[article-db] 无可用数据库连接，返回 null');
    return null;
  }
}

/**
 * 初始化 articles 表（幂等）
 * 如果表已存在则直接打开，否则创建空表
 */
export async function initArticlesTable() {
  const db = await getDb();
  if (!db) {
    console.error('[article-db] initArticlesTable: 数据库不可用');
    return null;
  }
  const tableNames = await db.tableNames();
  if (tableNames.includes(ARTICLES_TABLE)) {
    try {
      return await db.openTable(ARTICLES_TABLE);
    } catch (error) {
      console.error('[article-db] Error opening existing table, will recreate:', error);
      // Table exists but is corrupted, drop and recreate
      await db.dropTable(ARTICLES_TABLE);
    }
  }
  /*-- 创建包含一条占位记录的表，然后删除占位记录 --*/
  const table = await db.createTable(ARTICLES_TABLE, [
    {
      slug: "__placeholder__",
      sourceUrl: "",
      originalContent: "",
      translatedContent: "",
      contentHash: "",
      fetchedAt: "",
      translatedAt: "",
      originalLang: "en",
      title: "",
      description: "",
      author: "",
      coverImage: "",
      wordCount: 0,
      fetchStatus: "pending",
    },
  ]);
  await table.delete('slug = "__placeholder__"');
  return table;
}

/**
 * 转义 slug 中的特殊字符，防止 LanceDB where 子句注入
 */
function escapeSlug(slug: string): string {
  return slug.replace(/"/g, '\\"').replace(/\\/g, "\\\\");
}

/**
 * 解析 content 表记录的 frontmatter JSON 字符串。
 * 字段顺序不保证，读取方不得依赖顺序；解析失败按空对象处理，不让单条坏记录拖垮页面。
 */
function parseFrontmatter(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch (error) {
    console.error(`[article-db] frontmatter JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/*-- frontmatter 取值助手：字符串兜空串，数字兜 0 --*/
function fmStr(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function fmNum(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * 按 slug 查询文章（读 content 表 posts 集合，path 即文件名去扩展名）
 *
 * 正文取自记录的 originalBody / translatedBody；抓取期元数据（title/description/
 * author/coverImage/wordCount 等）迁移时并入 frontmatter 的 fetched 子对象，
 * 优先取 fetched、缺失时回退到 frontmatter 顶层（管理端新建条目没有 fetched）。
 * 返回值字段与 articles 表时代一致，src/pages/posts/** 调用方零改动。
 */
export async function getArticleBySlug(
  slug: string
): Promise<ArticleRecord | null> {
  try {
    console.log(`[article-db] 查询文章: ${slug}`);
    const entry = await getEntry("posts", slug);
    if (!entry) {
      console.warn(`[article-db] content 表无 posts/${slug} 记录`);
      return null;
    }

    const frontmatter = parseFrontmatter(entry.frontmatter);
    const fetchedValue = frontmatter.fetched;
    const fetched: Record<string, unknown> =
      fetchedValue && typeof fetchedValue === "object"
        ? (fetchedValue as Record<string, unknown>)
        : {};

    const fetchStatus = fmStr(fetched.fetchStatus);
    return {
      slug: entry.path,
      sourceUrl: fmStr(frontmatter.sourceUrl),
      originalContent: entry.originalBody,
      translatedContent: entry.translatedBody,
      contentHash: fmStr(fetched.contentHash),
      fetchedAt: fmStr(fetched.fetchedAt) || entry.updatedAt,
      translatedAt: fmStr(fetched.translatedAt),
      originalLang: fmStr(frontmatter.originalLang) || "en",
      title: fmStr(fetched.title) || fmStr(frontmatter.title) || entry.path,
      description: fmStr(fetched.description) || fmStr(frontmatter.description),
      author: fmStr(fetched.author) || fmStr(frontmatter.originalAuthor),
      coverImage: fmStr(fetched.coverImage) || fmStr(frontmatter.coverImage),
      wordCount: fmNum(fetched.wordCount),
      fetchStatus:
        fetchStatus === "success" || fetchStatus === "failed" || fetchStatus === "pending"
          ? fetchStatus
          : "pending",
    };
  } catch (error) {
    console.error(`[article-db] Error fetching article by slug "${slug}":`, error);
    return null;
  }
}

/**
 * 查询所有文章记录（按 fetchedAt 降序）
 */
export async function getAllArticles(): Promise<ArticleRecord[]> {
  try {
    const db = await getDb();
    if (!db) {
      console.error('[article-db] getAllArticles: 数据库不可用');
      return [];
    }
    const tableNames = await db.tableNames();
    if (!tableNames.includes(ARTICLES_TABLE)) return [];

    let table;
    try {
      table = await db.openTable(ARTICLES_TABLE);
    } catch (error) {
      console.error('[article-db] Error opening table for getAllArticles, will try to recreate:', error);
      try {
        await db.dropTable(ARTICLES_TABLE);
        table = await initArticlesTable();
      } catch (recreateError) {
        console.error('[article-db] Failed to recreate table:', recreateError);
        return [];
      }
    }

    const rows = await table.query().toArray();
    return rows as unknown as ArticleRecord[];
  } catch (error) {
    console.error('[article-db] Error fetching all articles:', error);
    return [];
  }
}

/**
 * 按抓取状态查询文章
 */
export async function getArticlesByStatus(
  status: ArticleRecord["fetchStatus"]
): Promise<ArticleRecord[]> {
  try {
    const db = await getDb();
    if (!db) {
      console.error(`[article-db] getArticlesByStatus: 数据库不可用`);
      return [];
    }
    const tableNames = await db.tableNames();
    if (!tableNames.includes(ARTICLES_TABLE)) return [];

    let table;
    try {
      table = await db.openTable(ARTICLES_TABLE);
    } catch (error) {
      console.error('[article-db] Error opening table for getArticlesByStatus, will try to recreate:', error);
      try {
        await db.dropTable(ARTICLES_TABLE);
        table = await initArticlesTable();
      } catch (recreateError) {
        console.error('[article-db] Failed to recreate table:', recreateError);
        return [];
      }
    }

    const rows = await table
      .query()
      .where(`fetchStatus = "${status}"`)
      .toArray();
    return rows as unknown as ArticleRecord[];
  } catch (error) {
    console.error(`[article-db] Error fetching articles by status "${status}":`, error);
    return [];
  }
}

/**
 * 存储或更新文章记录
 * 如果 slug 已存在则覆盖，否则插入新记录
 */
export async function saveArticle(record: ArticleRecord): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('[article-db] saveArticle: 数据库不可用，无法保存文章');
  }
  const tableNames = await db.tableNames();
  let table;
  if (!tableNames.includes(ARTICLES_TABLE)) {
    table = await initArticlesTable();
  } else {
    try {
      table = await db.openTable(ARTICLES_TABLE);
    } catch (error) {
      console.error('[article-db] Error opening table for saveArticle, will recreate:', error);
      await db.dropTable(ARTICLES_TABLE);
      table = await initArticlesTable();
    }
  }
  /*-- 先尝试删除同 slug 的旧记录 --*/
  try {
    await table.delete(`slug = "${record.slug}"`);
  } catch (error) {
    /*-- 表可能为空，忽略 --*/
    console.debug(`[article-db] Delete before save (may be empty table):`, error);
  }
  await table.add([record as unknown as Record<string, unknown>]);
}

/**
 * 计算内容哈希（基于 URL + 内容前 500 字符）
 */
export function computeContentHash(url: string, content: string): string {
  const input = `${url}::${content.slice(0, 500)}`;
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * 计算英文阅读时间（分钟）
 */
export function estimateReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * 从 URL 提取域名
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * 构建期关联内容条目
 */
export interface RelatedContent {
  title: string;
  url: string;
  collection: string;
  slug: string;
  similarity: number;
}

/**
 * 构建期关联内容：基于 blog_index 表向量相似度，找出当前条目的站内最近邻。
 * 与知识图谱 API 同源数据。完全容错——任何失败返回 []，绝不中断构建。
 */
export async function getRelatedContent(slug: string, limit = 3): Promise<RelatedContent[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const tableNames = await db.tableNames();
    const tableName = process.env.LANCEDB_TABLE || "blog_index";
    if (!tableNames.includes(tableName)) return [];

    let table;
    try {
      table = await db.openTable(tableName);
    } catch (error) {
      console.error(`[article-db] getRelatedContent 打开 ${tableName} 失败:`, error);
      return [];
    }

    /*-- 定位当前条目：先按 slug 匹配，优先 posts 集合 --*/
    const rows = (await table
      .query()
      .where(`slug = "${escapeSlug(slug)}"`)
      .limit(5)
      .toArray()) as Record<string, unknown>[];
    let current = rows.find((r) => String(r.collection) === "posts") || rows[0];
    if (!current) {
      const byUrl = (await table
        .query()
        .where(`url = "/posts/${escapeSlug(slug)}"`)
        .limit(1)
        .toArray()) as Record<string, unknown>[];
      current = byUrl[0];
    }
    if (!current) return [];

    const vector = current.vector as { length: number } | undefined;
    if (!vector || vector.length === 0) return [];

    const currentId = String(current.id ?? "");
    const neighbors = (await table
      .search(vector)
      .limit(limit + 2)
      .toArray()) as Record<string, unknown>[];

    const result: RelatedContent[] = [];
    for (const n of neighbors) {
      if (String(n.id ?? "") === currentId) continue;
      const url = String(n.url ?? "");
      if (!url || url === "#" || url === "/") continue;
      const distance =
        typeof n._distance === "number"
          ? n._distance
          : typeof n.score === "number"
            ? n.score
            : Number.POSITIVE_INFINITY;
      const similarity = Number.isFinite(distance) ? 1 / (1 + Math.max(0, distance)) : 0;
      if (similarity <= 0) continue;
      result.push({
        title: String(n.title ?? url),
        url,
        collection: String(n.collection ?? ""),
        slug: String(n.slug ?? ""),
        similarity,
      });
      if (result.length >= limit) break;
    }
    return result;
  } catch (error) {
    console.warn(
      `[article-db] getRelatedContent 失败，降级为空: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}
