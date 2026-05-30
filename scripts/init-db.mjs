import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";

dotenv.config();

const log = new Logger("init-db");

/*===== 配置常量 =====*/
const SF_MODEL = "BAAI/bge-m3";
const TABLE_NAME = process.env.LANCEDB_TABLE || "blog_index";
const CONTENT_DIRS = ["src/content/posts", "src/content/knowledge-base", "src/content/wiki"];
const EMBEDDING_DIM = Number.parseInt(process.env.EMBEDDING_DIM || "1024", 10);
const LOCAL_DB_PATH = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
const CLOUD_REQUIRED = process.env.LANCEDB_CLOUD_REQUIRED === "true";
const EMBED_BATCH_SIZE = 20;
const MAX_CONCURRENT_BATCHES = 3;

/*===== 工具函数 =====*/

function computeContentHash(text) {
  return crypto.createHash("md5").update(text, "utf8").digest("hex");
}

function getMarkdownFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getMarkdownFiles(filePath, files);
      continue;
    }
    if (filePath.endsWith(".md") || filePath.endsWith(".mdx")) {
      files.push(filePath);
    }
  }
  return files;
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[>#*_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*===== 向量生成 =====*/

async function getEmbeddings(texts) {
  const sfToken = process.env.SF_TOKEN;
  if (!sfToken) {
    throw new Error("SF_TOKEN is missing");
  }

  const response = await fetch("https://api.siliconflow.cn/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sfToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SF_MODEL,
      input: texts,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const sorted = data.data.sort((a, b) => a.index - b.index);
  return sorted.map((item) => item.embedding);
}

function fallbackEmbedding(text) {
  const vec = new Array(EMBEDDING_DIM).fill(0);
  const chars = Array.from(text);
  if (chars.length === 0) return vec;

  for (let i = 0; i < chars.length; i++) {
    const code = chars[i].codePointAt(0) ?? 0;
    const idxA = (code * 31 + i * 17) % EMBEDDING_DIM;
    const idxB = (code * 13 + i * 29 + 7) % EMBEDDING_DIM;
    const weight = 1 + (code % 11) / 10;
    vec[idxA] += weight;
    vec[idxB] -= weight * 0.7;
  }

  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

async function embedAllEntries(entries) {
  if (entries.length === 0) return [];

  const batches = [];
  for (let i = 0; i < entries.length; i += EMBED_BATCH_SIZE) {
    batches.push(entries.slice(i, i + EMBED_BATCH_SIZE));
  }

  const results = new Array(entries.length);
  let batchIndex = 0;

  async function processBatch() {
    while (batchIndex < batches.length) {
      const currentBatchIdx = batchIndex++;
      const batch = batches[currentBatchIdx];
      const texts = batch.map((e) => e.textToEmbed);
      const globalOffset = currentBatchIdx * EMBED_BATCH_SIZE;

      let vectors;
      try {
        vectors = await getEmbeddings(texts);
      } catch (error) {
        log.warn(`批量向量化失败，降级本地向量 (batch ${currentBatchIdx + 1}): ${error.message}`);
        vectors = texts.map((t) => fallbackEmbedding(t));
      }

      for (let i = 0; i < batch.length; i++) {
        const entry = batch[i];
        results[globalOffset + i] = {
          id: entry.relativePath,
          collection: entry.collection,
          slug: entry.slug,
          title: entry.title,
          content: entry.content,
          contentHash: entry.contentHash,
          url: entry.url,
          vector: vectors[i],
        };
      }
    }
  }

  const workers = [];
  for (let i = 0; i < MAX_CONCURRENT_BATCHES; i++) {
    workers.push(processBatch());
  }
  await Promise.all(workers);

  return results.filter(Boolean);
}

/*===== 文件解析 =====*/

function parseFileEntries(files) {
  const entries = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf-8");
    const { data, content } = matter(raw);

    const relativePath = path.relative(process.cwd(), file).replace(/\\/g, "/");
    const collectionMatch = relativePath.match(/^src\/content\/(posts|knowledge-base|wiki)\//);
    const collection = collectionMatch ? collectionMatch[1] : "posts";
    const normalizedPath = relativePath.replace(/^src\/content\/(posts|knowledge-base|wiki)\//, "");
    const fullSlug = normalizedPath.replace(/\.mdx?$/, "");
    const slug = collection === "posts" ? path.basename(file).replace(/\.mdx?$/, "") : fullSlug;
    const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug;
    const plainText = stripMarkdown(content).slice(0, 700);
    const textToEmbed = `标题: ${title}\n内容: ${plainText}`;
    const contentHash = computeContentHash(textToEmbed);

    entries.push({
      relativePath,
      collection,
      slug,
      title,
      content: plainText,
      textToEmbed,
      contentHash,
      url: collection === "wiki" ? `/wiki/${slug}` : `/${collection}/${slug}`,
    });
  }
  return entries;
}

/*===== LanceDB 操作 =====*/

async function getExistingHashes(table) {
  try {
    const rows = await table.query().select(["id", "contentHash"]).toArray();
    const map = new Map();
    for (const row of rows) {
      map.set(String(row.id), String(row.contentHash ?? ""));
    }
    return map;
  } catch (error) {
    log.warn(`无法读取已有哈希: ${error.message}`);
    return new Map();
  }
}

async function connectToDatabase() {
  const { LANCEDB_URI, LANCEDB_API_KEY } = process.env;
  const localDbUri = path.join(process.cwd(), LOCAL_DB_PATH);
  let db = null;
  let isCloud = false;

  if (LANCEDB_URI && LANCEDB_API_KEY) {
    try {
      log.database("连接 LanceDB Cloud...");
      db = await lancedb.connect(LANCEDB_URI, { apiKey: LANCEDB_API_KEY });
      isCloud = true;
      log.success("LanceDB Cloud 连接成功");
    } catch (error) {
      log.warn(`LanceDB Cloud 连接失败: ${error.message}`);
    }
  }

  if (!db && !CLOUD_REQUIRED) {
    log.database("使用本地 LanceDB...");
    db = await lancedb.connect(localDbUri);
    log.success("本地 LanceDB 连接成功");
  }

  if (!db) {
    throw new Error("LANCEDB_CLOUD_REQUIRED=true，但云端连接失败。");
  }

  return { db, isCloud };
}

async function ensureTable(db, tableName, schema) {
  const tableNames = await db.tableNames();
  if (tableNames.includes(tableName)) {
    try {
      const table = await db.openTable(tableName);
      await table.query().limit(1).toArray();
      return table;
    } catch (error) {
      log.warn(`${tableName} 表损坏，正在重建: ${error.message}`);
      try { await db.dropTable(tableName); } catch { /* ignore */ }
    }
  }
  const table = await db.createTable(tableName, schema);
  await table.delete('slug = "__placeholder__"');
  log.success(`${tableName} 表已创建`);
  return table;
}

/*===== 主流程 =====*/

async function main() {
  log.start("知识图谱索引构建");
  
  /*-- 1. 扫描文件 --*/
  const absoluteDirs = CONTENT_DIRS.map((d) => path.join(process.cwd(), d));
  const files = absoluteDirs.flatMap((dir) => getMarkdownFiles(dir));

  if (files.length === 0) {
    log.info("未找到 Markdown 文件，已跳过");
    return;
  }

  const fileEntries = parseFileEntries(files);
  log.info(`扫描到 ${fileEntries.length} 篇内容`);

  /*-- 2. 连接数据库 --*/
  const { db, isCloud } = await connectToDatabase();

  /*-- 3. 检查已有表 --*/
  let table = null;
  let schemaMismatch = false;
  
  try {
    const existingTables = await db.tableNames();
    if (existingTables.includes(TABLE_NAME)) {
      table = await db.openTable(TABLE_NAME);
      const testRows = await table.query().limit(1).toArray();
      if (testRows.length > 0) {
        const existingFields = Object.keys(testRows[0]);
        const requiredFields = ["id", "collection", "slug", "title", "content", "url", "vector"];
        const missingFields = requiredFields.filter(f => !existingFields.includes(f));
        if (missingFields.length > 0) {
          log.warn(`${TABLE_NAME} 表 schema 不匹配，缺少字段: ${missingFields.join(", ")}`);
          schemaMismatch = true;
        }
      }
    }
  } catch (error) {
    log.warn(`${TABLE_NAME} 表损坏，将重新创建: ${error.message}`);
    schemaMismatch = true;
  }

  if (schemaMismatch && table) {
    try {
      log.reset(`删除 schema 不匹配的 ${TABLE_NAME} 表...`);
      await db.dropTable(TABLE_NAME);
      table = null;
    } catch (error) {
      log.error(`删除 ${TABLE_NAME} 表失败: ${error.message}`);
    }
  }

  /*-- 4. 确保 articles 表存在 --*/
  await ensureTable(db, "articles", [{
    slug: "__placeholder__", sourceUrl: "", originalContent: "", translatedContent: "",
    contentHash: "", fetchedAt: "", translatedAt: "", originalLang: "en",
    title: "", description: "", author: "", coverImage: "", wordCount: 0, fetchStatus: "pending",
  }]);

  /*-- 5. 全量覆写（首次运行或表不存在）--*/
  if (!table) {
    log.start(`首次运行，全量向量化 ${fileEntries.length} 篇内容...`);
    const rows = await embedAllEntries(fileEntries);
    const cleanRows = rows.map(({ contentHash, ...rest }) => rest);
    await db.createTable(TABLE_NAME, cleanRows, { mode: "overwrite" });
    log.success(`完成，已写入 ${cleanRows.length} 条数据（全量覆写）`);
    return;
  }

  /*-- 6. 增量更新 --*/
  const existingHashes = await getExistingHashes(table);
  const currentIds = new Set(fileEntries.map((e) => e.relativePath));

  const added = [];
  const modified = [];
  const unchanged = [];

  for (const entry of fileEntries) {
    const existingHash = existingHashes.get(entry.relativePath);
    if (!existingHash) {
      added.push(entry);
    } else if (existingHash !== entry.contentHash) {
      modified.push(entry);
    } else {
      unchanged.push(entry);
    }
  }

  const deletedIds = [...existingHashes.keys()].filter((id) => !currentIds.has(id));

  log.stats({
    "新增": added.length,
    "修改": modified.length,
    "未变": unchanged.length,
    "删除": deletedIds.length
  });

  const toEmbed = [...added, ...modified];
  if (toEmbed.length === 0 && deletedIds.length === 0) {
    log.success("无变化，跳过");
    return;
  }

  /*-- 7. 向量化变化内容 --*/
  if (toEmbed.length > 0) {
    log.process(`向量化 ${toEmbed.length} 篇变化内容...`);
  }

  const rows = await embedAllEntries(toEmbed);

  /*-- 8. 增量写入 --*/
  if (rows.length > 0) {
    log.save(`增量写入 ${rows.length} 条数据...`);
    const cleanRows = rows.map(({ contentHash, ...rest }) => rest);
    await table.mergeInsert("id")
      .whenMatchedUpdateAll()
      .whenNotMatchedInsertAll()
      .execute(cleanRows);
  }

  /*-- 9. 删除已移除的行 --*/
  if (deletedIds.length > 0) {
    log.delete(`删除 ${deletedIds.length} 条已移除数据...`);
    for (const id of deletedIds) {
      const escaped = id.replace(/'/g, "''");
      await table.delete(`id = '${escaped}'`);
    }
  }

  /*-- 10. 优化表（仅本地数据库）--*/
  if (!isCloud) {
    await table.optimize();
  }

  log.summary({
    "写入": rows.length,
    "删除": deletedIds.length,
    "总记录": fileEntries.length
  });
}

main().catch((error) => {
  log.error(`初始化失败: ${error.message}`);
  process.exitCode = 1;
});
