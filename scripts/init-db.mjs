import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";

dotenv.config();

// 硅基流动推荐使用的强大中文向量模型，维度默认 1024
const SF_MODEL = "BAAI/bge-m3";
const TABLE_NAME = process.env.LANCEDB_TABLE || "blog_index";
const CONTENT_DIRS = ["src/content/posts", "src/content/knowledge-base", "src/content/wiki"];
// 注意：bge-m3 模型的输出维度是 1024，默认值已修改
const EMBEDDING_DIM = Number.parseInt(process.env.EMBEDDING_DIM || "1024", 10);
const LOCAL_DB_PATH = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
const CLOUD_REQUIRED = process.env.LANCEDB_CLOUD_REQUIRED === "true";
const EMBED_BATCH_SIZE = 20;
const MAX_CONCURRENT_BATCHES = 3;

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

// 采用硅基流动 (SiliconFlow) 的批量 API 生成向量
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
  // 按 index 排序确保与输入顺序一致
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
        console.warn(`⚠️ 批量向量化失败，降级本地向量 (batch ${currentBatchIdx + 1}): ${error.message}`);
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

async function getExistingHashes(table) {
  try {
    const rows = await table.query().select(["id", "contentHash"]).toArray();
    const map = new Map();
    for (const row of rows) {
      map.set(String(row.id), String(row.contentHash ?? ""));
    }
    return map;
  } catch (error) {
    console.warn(`⚠️ 无法读取已有哈希: ${error.message}`);
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
      console.log("☁️ 连接 LanceDB Cloud...");
      db = await lancedb.connect(LANCEDB_URI, { apiKey: LANCEDB_API_KEY });
      isCloud = true;
    } catch (error) {
      console.warn(`⚠️ LanceDB Cloud 连接失败: ${error.message}`);
    }
  }

  if (!db && !CLOUD_REQUIRED) {
    console.log("📂 使用本地 LanceDB...");
    db = await lancedb.connect(localDbUri);
  }

  if (!db) {
    throw new Error("LANCEDB_CLOUD_REQUIRED=true，但云端连接失败。");
  }

  return { db, isCloud };
}

async function main() {
  const absoluteDirs = CONTENT_DIRS.map((d) => path.join(process.cwd(), d));
  const files = absoluteDirs.flatMap((dir) => getMarkdownFiles(dir));

  if (files.length === 0) {
    console.log("未找到 Markdown 文件，已跳过。");
    return;
  }

  // Phase 1: 解析文件，计算哈希（不做向量化）
  const fileEntries = parseFileEntries(files);
  console.log(`🔍 扫描到 ${fileEntries.length} 篇内容`);

  // Phase 2: 连接数据库
  const { db, isCloud } = await connectToDatabase();

  // Phase 3: 检查已有表
  let table = null;
  try {
    const existingTables = await db.tableNames();
    if (existingTables.includes(TABLE_NAME)) {
      table = await db.openTable(TABLE_NAME);
    }
  } catch {
    // 表不存在，使用全量覆写
  }

  // Phase 3a: 全量覆写（首次运行或表不存在）
  if (!table) {
    console.log(`🚀 首次运行，全量向量化 ${fileEntries.length} 篇内容...`);
    const rows = await embedAllEntries(fileEntries);
    await db.createTable(TABLE_NAME, rows, { mode: "overwrite" });
    console.log(`✅ 完成，已写入 ${rows.length} 条数据（全量覆写）。`);
    return;
  }

  // Phase 3b: 增量更新
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

  console.log(`📊 增量分析: +${added.length} 新增, ~${modified.length} 修改, =${unchanged.length} 未变, -${deletedIds.length} 删除`);

  const toEmbed = [...added, ...modified];
  if (toEmbed.length === 0 && deletedIds.length === 0) {
    console.log("✅ 无变化，跳过。");
    return;
  }

  // Phase 4: 仅对变化的条目做向量化
  if (toEmbed.length > 0) {
    console.log(`🚀 向量化 ${toEmbed.length} 篇变化内容...`);
  }

  const rows = await embedAllEntries(toEmbed);

  // Phase 5: 通过 mergeInsert 做增量写入
  if (rows.length > 0) {
    console.log(`📝 增量写入 ${rows.length} 条数据...`);
    await table.mergeInsert("id")
      .whenMatchedUpdateAll()
      .whenNotMatchedInsertAll()
      .execute(rows);
  }

  // Phase 6: 删除已移除的行
  if (deletedIds.length > 0) {
    console.log(`🗑️ 删除 ${deletedIds.length} 条已移除数据...`);
    for (const id of deletedIds) {
      const escaped = id.replace(/'/g, "''");
      await table.delete(`id = '${escaped}'`);
    }
  }

  // Phase 7: 优化表
  await table.optimize();

  console.log(`✅ 完成: upsert ${rows.length}, delete ${deletedIds.length}`);
}

main().catch((error) => {
  console.error("初始化失败:", error);
  process.exitCode = 1;
});
