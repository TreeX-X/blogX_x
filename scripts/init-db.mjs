import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";

dotenv.config();

// 硅基流动推荐使用的强大中文向量模型，维度默认 1024
const SF_MODEL = "BAAI/bge-m3";
const TABLE_NAME = process.env.LANCEDB_TABLE || "blog_index";
const CONTENT_DIRS = ["src/content/posts", "src/content/knowledge-base"];
// 注意：bge-m3 模型的输出维度是 1024，默认值已修改
const EMBEDDING_DIM = Number.parseInt(process.env.EMBEDDING_DIM || "1024", 10);
const LOCAL_DB_PATH = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
const CLOUD_REQUIRED = process.env.LANCEDB_CLOUD_REQUIRED === "true";

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

// 采用硅基流动 (SiliconFlow) 的 API 生成向量
async function getEmbedding(text) {
  const sfToken = process.env.SF_TOKEN;
  if (!sfToken) {
    throw new Error("SF_TOKEN is missing");
  }

  const response = await fetch("https://api.siliconflow.cn/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sfToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: SF_MODEL,
      input: text,
      encoding_format: "float"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  // 返回 OpenAI 兼容格式的向量数组
  return data.data[0].embedding;
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

async function main() {
  const { LANCEDB_URI, LANCEDB_API_KEY } = process.env;

  const absoluteDirs = CONTENT_DIRS.map((d) => path.join(process.cwd(), d));
  const files = absoluteDirs.flatMap((dir) => getMarkdownFiles(dir));

  if (files.length === 0) {
    console.log("未找到 Markdown 文件，已跳过。");
    return;
  }

  console.log(`🚀 开始同步 ${files.length} 篇内容到 LanceDB...`);

  const rows = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf-8");
    const { data, content } = matter(raw);

    const relativePath = path.relative(process.cwd(), file).replace(/\\/g, "/");
    const collection = relativePath.includes("/knowledge-base/") ? "knowledge-base" : "posts";
    const normalizedPath = relativePath.replace(/^src\/content\/(posts|knowledge-base)\//, "");
    const fullSlug = normalizedPath.replace(/\.mdx?$/, "");
    const slug = collection === "knowledge-base" ? fullSlug : path.basename(file).replace(/\.mdx?$/, "");
    const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug;
    const plainText = stripMarkdown(content).slice(0, 700);
    const textToEmbed = `标题: ${title}\n内容: ${plainText}`;

    console.log(`处理中: ${relativePath}`);

    let vector;
    try {
      vector = await getEmbedding(textToEmbed);
    } catch (error) {
      console.warn(`⚠️ 硅基流动 向量化失败，已降级本地向量: ${relativePath} (${error.message})`);
      vector = fallbackEmbedding(textToEmbed);
    }

    rows.push({
      id: relativePath,
      collection,
      slug,
      title,
      content: plainText,
      url: `/${collection}/${slug}`,
      vector,
    });
  }

  if (rows.length === 0) {
    console.log("没有可写入的向量数据。");
    return;
  }

  const localDbUri = path.join(process.cwd(), LOCAL_DB_PATH);
  let wrote = false;

  if (LANCEDB_URI && LANCEDB_API_KEY) {
    try {
      console.log("☁️ 连接 LanceDB Cloud...");
      const cloudDb = await lancedb.connect(LANCEDB_URI, { apiKey: LANCEDB_API_KEY });
      console.log(`📝 写入云表 ${TABLE_NAME}（overwrite）...`);
      await cloudDb.createTable(TABLE_NAME, rows, { mode: "overwrite" });
      wrote = true;
    } catch (error) {
      console.warn(`⚠️ LanceDB Cloud 写入失败，回退本地数据库: ${LOCAL_DB_PATH} (${error.message})`);
    }
  }

  if (CLOUD_REQUIRED && !wrote) {
    throw new Error("LANCEDB_CLOUD_REQUIRED=true，但云端写入失败。");
  }

  if (!wrote && !CLOUD_REQUIRED) {
    const localDb = await lancedb.connect(localDbUri);
    console.log(`📝 写入本地表 ${TABLE_NAME}（overwrite）...`);
    await localDb.createTable(TABLE_NAME, rows, { mode: "overwrite" });
  }

  console.log(`✅ 完成，已写入 ${rows.length} 条数据。`);
}

main().catch((error) => {
  console.error("初始化失败:", error);
  process.exitCode = 1;
});
