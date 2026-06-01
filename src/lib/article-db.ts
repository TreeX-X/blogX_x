/**
 * LanceDB 文章存储工具
 * 负责从 LanceDB 读取/写入抓取的文章原文和翻译
 */
import * as lancedb from "@lancedb/lancedb";
import crypto from "node:crypto";
import path from "node:path";

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
let dbInstance: Awaited<ReturnType<typeof lancedb.connect>> | null = null;

/**
 * 获取数据库连接（单例模式）
 * 优先连接 LanceDB Cloud，失败时降级到本地 LanceDB
 */
async function getDb() {
  if (dbInstance) return dbInstance;

  const { LANCEDB_URI, LANCEDB_API_KEY } = process.env;

  /*-- 优先尝试 LanceDB Cloud --*/
  if (LANCEDB_URI && LANCEDB_API_KEY) {
    try {
      dbInstance = await lancedb.connect(LANCEDB_URI, { apiKey: LANCEDB_API_KEY });
      return dbInstance;
    } catch (error) {
      console.warn(`[article-db] LanceDB Cloud 连接失败，降级到本地: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /*-- 降级到本地 LanceDB --*/
  const localPath = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
  const dbUri = path.join(process.cwd(), localPath);
  dbInstance = await lancedb.connect(dbUri);
  return dbInstance;
}

/**
 * 初始化 articles 表（幂等）
 * 如果表已存在则直接打开，否则创建空表
 */
export async function initArticlesTable() {
  const db = await getDb();
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
 * 按 slug 查询文章
 */
export async function getArticleBySlug(
  slug: string
): Promise<ArticleRecord | null> {
  try {
    const db = await getDb();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(ARTICLES_TABLE)) return null;
    
    let table;
    try {
      table = await db.openTable(ARTICLES_TABLE);
    } catch (error) {
      console.error('[article-db] Error opening table, will try to recreate:', error);
      // Table exists but is corrupted, try to recreate
      try {
        await db.dropTable(ARTICLES_TABLE);
        table = await initArticlesTable();
      } catch (recreateError) {
        console.error('[article-db] Failed to recreate table:', recreateError);
        return null;
      }
    }
    
    const safeSlug = escapeSlug(slug);
    const rows = await table
      .query()
      .where(`slug = "${safeSlug}"`)
      .limit(1)
      .toArray();
    if (rows.length === 0) return null;
    return rows[0] as unknown as ArticleRecord;
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
