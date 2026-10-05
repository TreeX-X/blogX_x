/**
 * 内容云存储层：LanceDB `content` 表的唯一读写入口
 *
 * 记录字段：collection / path / frontmatter / body / originalBody /
 * translatedBody / status / updatedAt。
 * - path 为集合内相对路径（不含扩展名），嵌套目录保留，如 `AI使用技巧/AI评选`；
 * - frontmatter 以 JSON 字符串存储，读写双方自行 parse/stringify，字段顺序不保证；
 * - originalBody / translatedBody 仅 posts 使用（文章双语正文），其余集合为空串。
 *
 * 查询一律全表 scan 后在 JS 端按 collection + path 过滤：path 含中文、全角冒号、
 * 圆括号与空格，where 字符串拼接的转义与注入风险高于收益。删除/ upsert 的谓词同样
 * 不做字符串拼接，只走 sqlLiteral 转义后的等值条件。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 */
import path from "node:path";
import type { CollectionKey } from "./content-schemas";
import type { Connection, Table } from "@lancedb/lancedb";

/*-- 动态导入 LanceDB，避免原生模块在不兼容环境（如 Vercel serverless）下崩溃整个页面（与 article-db 同一实践）--*/
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
    console.error(`[content-store] LanceDB 原生模块加载失败: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/*-- 发布状态：草稿跨机器可见，不依赖本地文件 --*/
export type ContentStatus = "published" | "draft";

/*-- content 表的记录类型。frontmatter 为 JSON 字符串，读取方自行 JSON.parse --*/
export interface ContentRecord {
  collection: CollectionKey;
  path: string;
  frontmatter: string;
  body: string;
  originalBody: string;
  translatedBody: string;
  status: ContentStatus;
  updatedAt: string;
}

/*-- 表名常量 --*/
const CONTENT_TABLE = "content";

/*-- 建表占位行：LanceDB createTable 需要至少一行推断 schema，随后删除 --*/
const PLACEHOLDER_PATH = "__placeholder__";

/*-- 数据库连接缓存 --*/
let dbInstance: Connection | null = null;

/**
 * 获取数据库连接（单例模式）
 * 优先连接 LanceDB Cloud（5 秒超时），失败时降级到本地 LanceDB（与 article-db、抓取脚本一致）
 */
async function getDb(): Promise<Connection | null> {
  if (dbInstance) return dbInstance;

  const lib = await loadLancedb();
  if (!lib) {
    console.error('[content-store] LanceDB 模块不可用，无法建立连接');
    return null;
  }

  const { LANCEDB_URI, LANCEDB_API_KEY } = process.env;

  /*-- 优先尝试 LanceDB Cloud（带 5 秒超时） --*/
  if (LANCEDB_URI && LANCEDB_API_KEY) {
    try {
      console.log('[content-store] 尝试连接 LanceDB Cloud...');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LanceDB Cloud 连接超时 (5s)')), 5000)
      );
      dbInstance = await Promise.race([
        lib.connect(LANCEDB_URI, { apiKey: LANCEDB_API_KEY }),
        timeoutPromise,
      ]);
      console.log('[content-store] LanceDB Cloud 连接成功');
      return dbInstance;
    } catch (error) {
      console.error(`[content-store] LanceDB Cloud 连接失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.warn('[content-store] LANCEDB_URI 或 LANCEDB_API_KEY 未设置');
  }

  /*-- 与抓取脚本保持一致：Cloud 失败时降级到本地 LanceDB，避免读写策略不一致 --*/
  try {
    const localDbPath = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
    const localDbUri = path.join(process.cwd(), localDbPath);
    console.warn(`[content-store] 降级到本地 LanceDB: ${localDbUri}`);
    dbInstance = await lib.connect(localDbUri);
    return dbInstance;
  } catch (error) {
    console.error(`[content-store] 本地 LanceDB 连接失败: ${error instanceof Error ? error.message : String(error)}`);
    console.error('[content-store] 无可用数据库连接，返回 null');
    return null;
  }
}

/*-- SQL 字符串字面量：单引号包裹、内部单引号加倍。中文/全角冒号/圆括号/空格均按字面量处理，无注入面 --*/
function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/*-- 把表行规整为 ContentRecord：字段缺失兜底为空串，status 只接受 published/draft --*/
function toContentRecord(row: Record<string, unknown>): ContentRecord {
  return {
    collection: row.collection as CollectionKey,
    path: String(row.path ?? ""),
    frontmatter: String(row.frontmatter ?? "{}"),
    body: String(row.body ?? ""),
    originalBody: String(row.originalBody ?? ""),
    translatedBody: String(row.translatedBody ?? ""),
    status: row.status === "draft" ? "draft" : "published",
    updatedAt: String(row.updatedAt ?? ""),
  };
}

/**
 * 打开已存在的 content 表；表不存在或打不开时返回 null（读取方按空处理）
 */
async function openContentTable(): Promise<Table | null> {
  const db = await getDb();
  if (!db) return null;
  const tableNames = await db.tableNames();
  if (!tableNames.includes(CONTENT_TABLE)) {
    console.warn(`[content-store] 表 ${CONTENT_TABLE} 不存在`);
    return null;
  }
  try {
    return await db.openTable(CONTENT_TABLE);
  } catch (error) {
    console.error(`[content-store] 打开 ${CONTENT_TABLE} 表失败:`, error);
    return null;
  }
}

/**
 * 打开 content 表，不存在则创建（幂等）
 * 建表范式与 articles 表一致：先建占位行推断 schema，再删除占位行
 */
async function ensureContentTable(): Promise<Table | null> {
  const db = await getDb();
  if (!db) return null;
  const tableNames = await db.tableNames();
  if (tableNames.includes(CONTENT_TABLE)) {
    return openContentTable();
  }
  console.log(`[content-store] 创建 ${CONTENT_TABLE} 表...`);
  const table = await db.createTable(CONTENT_TABLE, [
    {
      collection: "posts",
      path: PLACEHOLDER_PATH,
      frontmatter: "{}",
      body: "",
      originalBody: "",
      translatedBody: "",
      status: "draft",
      updatedAt: "",
    },
  ]);
  await table.delete(`path = ${sqlLiteral(PLACEHOLDER_PATH)}`);
  return table;
}

/**
 * 列出集合内全部记录（按 path 排序）。读取失败返回空数组，不抛异常。
 */
export async function listCollection(collection: CollectionKey): Promise<ContentRecord[]> {
  try {
    const table = await openContentTable();
    if (!table) return [];
    const rows = (await table.query().toArray()) as Record<string, unknown>[];
    return rows
      .filter((row) => row.collection === collection)
      .map(toContentRecord)
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  } catch (error) {
    console.error(`[content-store] listCollection "${collection}" 失败:`, error);
    return [];
  }
}

/**
 * 按 collection + path 精确取一条记录，无则返回 null。
 * 全表 scan 后 JS 端匹配，不用 where 拼 path。
 */
export async function getEntry(
  collection: CollectionKey,
  path: string
): Promise<ContentRecord | null> {
  try {
    const table = await openContentTable();
    if (!table) return null;
    const rows = (await table.query().toArray()) as Record<string, unknown>[];
    const row = rows.find((r) => r.collection === collection && String(r.path) === path);
    return row ? toContentRecord(row) : null;
  } catch (error) {
    console.error(`[content-store] getEntry "${collection}/${path}" 失败:`, error);
    return null;
  }
}

/**
 * 写入或更新一条记录。
 * LanceDB 无原地更新，必须先删同 (collection, path) 旧行再插入，保证不产生重复记录。
 */
export async function upsertEntry(record: ContentRecord): Promise<void> {
  const table = await ensureContentTable();
  if (!table) {
    throw new Error('[content-store] upsertEntry: 数据库不可用，无法写入');
  }
  try {
    await table.delete(
      `collection = ${sqlLiteral(record.collection)} AND path = ${sqlLiteral(record.path)}`
    );
  } catch (error) {
    /*-- 表为空或无匹配行时 delete 可能报错，忽略后直接插入 --*/
    console.debug(`[content-store] Delete before upsert (可能无匹配行):`, error);
  }
  await table.add([record as unknown as Record<string, unknown>]);
}

/**
 * 删除一条记录（幂等：记录不存在时视为已删除）
 */
export async function deleteEntry(collection: CollectionKey, path: string): Promise<void> {
  const table = await openContentTable();
  if (!table) {
    throw new Error('[content-store] deleteEntry: 数据库或 content 表不可用');
  }
  try {
    await table.delete(`collection = ${sqlLiteral(collection)} AND path = ${sqlLiteral(path)}`);
  } catch (error) {
    /*-- 无匹配行时 delete 可能报错，目标状态已达成 --*/
    console.debug(`[content-store] deleteEntry (可能无匹配行) "${collection}/${path}":`, error);
  }
}

/**
 * 切换记录的发布状态（发布/撤回草稿）。记录不存在时抛错。
 * 经 getEntry 读整行再 upsert 回写，避免为单字段更新再拼一条路径谓词。
 */
export async function setStatus(
  collection: CollectionKey,
  path: string,
  status: ContentStatus
): Promise<void> {
  const current = await getEntry(collection, path);
  if (!current) {
    throw new Error(`[content-store] setStatus: 记录不存在 ${collection}/${path}`);
  }
  await upsertEntry({ ...current, status, updatedAt: new Date().toISOString() });
}
