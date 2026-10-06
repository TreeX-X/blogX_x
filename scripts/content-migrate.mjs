#!/usr/bin/env node
/**
 * 一次性内容迁移：src/content/** → LanceDB `content` 表
 *
 * 一次性脚本：把"内容还在 git 里"的旧世界搬进 content 表。迁移早已完成（59 条），此后内容
 * 的入口是 dev 面板 / content:intake / sync-obsidian-kb --to-lancedb，本脚本只作为
 * "从一份遗留 src/content 重新灌表"的应急手段保留，不在日常流程里。
 *
 * 输入表 `articles` 即将废弃：站点侧零读取方（src/pages/** 只经 getArticleBySlug 读 content
 * 表），fetch-articles 与 maintenance 也都不再碰它。它的唯一剩余读者就是本脚本——所以本脚本
 * 也是"还不能立刻 drop articles 表"的原因：drop 之后这份脚本无法再从旧表恢复双语正文。
 * 后续动作见 T5 note（.agents/notes/2026-10-05-task-t5-cut-local-coupling--d0a6d506.md）。
 *
 * 会把六个集合的 markdown 灌入 content 表：frontmatter 解析后以 JSON 字符串存储、
 * body 原样保留、status 取 published（isDraft: true 的文件取 draft）、updatedAt 取文件 mtime。
 * posts 额外把 articles 表中对应篇目的双语正文合并进 originalBody / translatedBody。
 * 目标条数：posts 3 + knowledgeBase 15 + wiki 29 + repos 5 + skills 5 + projects 2 = 59
 * （knowledgeBase 的私人笔记按排除清单跳过，不迁移）。
 *
 * 用法：
 *   node scripts/content-migrate.mjs             # 执行迁移（幂等，可重跑）
 *   node scripts/content-migrate.mjs --dry-run   # 只扫描并报告，不写库
 *
 * 幂等性：按 (collection, path) 先删后插（LanceDB 无原地更新，必须删后插），
 * 重复执行不产生重复记录。`content` 表已存在且非空时按同键覆盖，不清空其他集合，
 * 也不删除表中间隙存在的其他记录（如管理端新建的条目）。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 * Note: 私人笔记禁迁 + vault 导入必须按条目选择 — see .agents/notes/2026-10-05-task-t1-content-store--a7c1fab4.md
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";
import { detectLanguage } from "../src/lib/article-translation.service.mjs";

dotenv.config();

const log = new Logger("content-migrate");

/*===== 配置常量 =====*/
const CONTENT_ROOT = "src/content";
const CONTENT_TABLE = "content";
const ARTICLES_TABLE = "articles";
const LOCAL_DB_PATH = process.env.LANCEDB_LOCAL_PATH || ".lancedb";

/*-- 集合键 → 目录。键必须与 src/content.config.ts 的集合键一致：
     内容云按这两个字段寻址，T2 的 content-pull 依赖它把记录映射回目录 --*/
const COLLECTIONS = {
  posts: "posts",
  knowledgeBase: "knowledge-base",
  wiki: "wiki",
  repos: "repos",
  skills: "skills",
  projects: "projects",
};

/*-- 私人笔记排除清单：判据为相对 src/content 的路径（集合目录 + 文件名）。
     用户 vault 中的私人笔记从未发布，已由 .git/info/exclude 本地排除；今后任何
     "从 vault 导入"都必须按条目在此登记并注明理由，禁止整库自动同步。 --*/
const PRIVATE_EXCLUDED = new Set([
  "knowledge-base/思路记载/未命名.md",
]);

/*===== 命令行参数 =====*/
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

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
  } else {
    log.warn("LANCEDB_URI 或 LANCEDB_API_KEY 未设置，使用本地 LanceDB");
  }

  /*-- 降级到本地 LanceDB（与抓取脚本一致） --*/
  const dbUri = path.join(process.cwd(), LOCAL_DB_PATH);
  log.database(`使用本地 LanceDB: ${dbUri}`);
  return lancedb.connect(dbUri);
}

async function ensureContentTable(db) {
  const tableNames = await db.tableNames();
  if (tableNames.includes(CONTENT_TABLE)) {
    try {
      const table = await db.openTable(CONTENT_TABLE);
      await table.query().limit(1).toArray();
      return table;
    } catch (error) {
      log.warn(`content 表损坏，正在重建: ${error.message}`);
      try { await db.dropTable(CONTENT_TABLE); } catch { /* ignore */ }
    }
  }
  const table = await db.createTable(CONTENT_TABLE, [{
    collection: "posts", path: "__placeholder__", frontmatter: "{}", body: "",
    originalBody: "", translatedBody: "", status: "draft", updatedAt: "",
  }]);
  await table.delete(`path = ${sqlLiteral("__placeholder__")}`);
  return table;
}

/*-- SQL 字符串字面量：单引号包裹、内部单引号加倍。中文/全角冒号/圆括号/空格均安全 --*/
function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

/*-- 先删同 (collection, path) 旧行再插入，重复执行不产生重复记录 --*/
async function upsertRecord(table, record) {
  try {
    await table.delete(`collection = ${sqlLiteral(record.collection)} AND path = ${sqlLiteral(record.path)}`);
  } catch { /*-- 表为空或无匹配行，忽略 --*/ }
  await table.add([record]);
}

/*===== articles 表选取 =====*/

/**
 * articles 表的历史 upsert 是"先删后插"，但旧 where 用双引号拼接字符串，删除从未命中，
 * 同一 slug 在表中留有多代记录，其中最新几代的译文语言与原文相同（抓取脚本的失败译文）。
 * 选取规则（语言判定复用抓取管线的 detectLanguage）：
 *   1. 只考虑 originalContent 非空的行；
 *   2. 优先取"译文语言与原文相反"的一代（真正的双语对），其中 translatedAt 最新；
 *   3. 无合格译文时退化为 fetchedAt 最新的一代，translatedBody 置空，
 *      避免把失败译文当成第二份正文 master。
 */
function isGenuineTranslation(row) {
  if (!row.translatedContent) return false;
  const originalLang = detectLanguage(row.originalContent, null);
  const translatedLang = detectLanguage(row.translatedContent, null);
  return originalLang !== "unknown" && translatedLang !== "unknown" && originalLang !== translatedLang;
}

function pickArticleRow(rows) {
  const withOriginal = rows.filter((row) => typeof row.originalContent === "string" && row.originalContent.length > 0);
  if (withOriginal.length === 0) return null;
  const genuine = withOriginal.filter(isGenuineTranslation);
  if (genuine.length > 0) {
    return genuine.reduce((latest, row) => (row.translatedAt > latest.translatedAt ? row : latest));
  }
  return withOriginal.reduce((latest, row) => (row.fetchedAt > latest.fetchedAt ? row : latest));
}

/*-- 读 articles 表，按 slug 各选一篇，返回 Map<slug, row> --*/
async function loadPickedArticles(db) {
  const picked = new Map();
  const tableNames = await db.tableNames();
  if (!tableNames.includes(ARTICLES_TABLE)) {
    log.warn(`${ARTICLES_TABLE} 表不存在，posts 记录将不带双语正文`);
    return picked;
  }
  const table = await db.openTable(ARTICLES_TABLE);
  const rows = await table.query().toArray();
  const bySlug = new Map();
  for (const row of rows) {
    const list = bySlug.get(row.slug) || [];
    list.push(row);
    bySlug.set(row.slug, list);
  }
  for (const [slug, list] of bySlug) {
    const row = pickArticleRow(list);
    if (row) picked.set(slug, row);
  }
  log.info(`${ARTICLES_TABLE} 表 ${rows.length} 行，按 slug 选取 ${picked.size} 篇（每 slug 取一代）`);
  return picked;
}

/*===== 文件扫描 =====*/

/*-- 递归收集集合目录下的 .md 文件，relPath 为集合内相对路径（正斜杠） --*/
function scanMarkdownFiles(dir) {
  const files = [];
  const walk = (current, relDir) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), rel);
      } else if (entry.name.endsWith(".md")) {
        files.push({ absPath: path.join(current, entry.name), relPath: rel });
      }
    }
  };
  walk(dir, "");
  return files.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
}

/**
 * 构造 content 表记录。
 * frontmatter 为原 YAML 解析后的对象（含 schema 之外的键，如 knowledge-base 的 source）；
 * posts 的抓取期元数据并入 frontmatter.fetched 子对象（sourceUrl / originalLang 等已有
 * frontmatter 字段不重复搬进独立字段），article-db 按同一约定读回。
 */
function buildRecord(collection, file, articleRow) {
  const raw = fs.readFileSync(file.absPath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = { ...data };

  if (collection === "posts" && articleRow) {
    frontmatter.fetched = {
      title: articleRow.title,
      description: articleRow.description,
      author: articleRow.author,
      coverImage: articleRow.coverImage,
      wordCount: articleRow.wordCount,
      fetchedAt: articleRow.fetchedAt,
      translatedAt: articleRow.translatedAt,
      contentHash: articleRow.contentHash,
      fetchStatus: articleRow.fetchStatus,
    };
  }

  return {
    collection,
    path: file.relPath.replace(/\.md$/, ""),
    frontmatter: JSON.stringify(frontmatter),
    body: content,
    originalBody: articleRow ? String(articleRow.originalContent || "") : "",
    translatedBody: articleRow ? String(articleRow.translatedContent || "") : "",
    status: data.isDraft === true ? "draft" : "published",
    updatedAt: fs.statSync(file.absPath).mtime.toISOString(),
  };
}

/*===== 主流程 =====*/

async function main() {
  log.start("内容迁移脚本启动");
  log.config(`模式: ${dryRun ? "dry-run（不写库）" : "执行迁移（幂等）"}`);

  /*-- 1. 扫描 src/content，按集合收集记录 --*/
  const records = [];
  const skipped = [];
  const counts = {};
  for (const [collection, dir] of Object.entries(COLLECTIONS)) {
    const collectionDir = path.join(CONTENT_ROOT, dir);
    if (!fs.existsSync(collectionDir)) {
      log.warn(`目录不存在，跳过: ${collectionDir}`);
      continue;
    }
    counts[collection] = 0;
    for (const file of scanMarkdownFiles(collectionDir)) {
      /*-- 私人笔记排除清单：相对 src/content 的路径命中即跳过 --*/
      if (PRIVATE_EXCLUDED.has(`${dir}/${file.relPath}`)) {
        skipped.push(`${dir}/${file.relPath}`);
        continue;
      }
      records.push({ collection, file });
      counts[collection] += 1;
    }
    log.file(`${collection}: ${counts[collection]} 条 ← ${collectionDir}`);
  }

  for (const item of skipped) {
    log.skip(`${item} — 私人笔记，按排除清单跳过`);
  }
  log.info(`待迁移记录: ${records.length} 条${skipped.length > 0 ? `（跳过 ${skipped.length} 条）` : ""}`);

  /*-- 2. 连接数据库，读取 articles 表选取结果 --*/
  const db = await getDb();
  const articles = await loadPickedArticles(db);

  /*-- 3. 构造记录（posts 合并双语正文） --*/
  const built = records.map(({ collection, file }) => {
    const articleRow = collection === "posts" ? articles.get(file.relPath.replace(/\.md$/, "")) : undefined;
    if (collection === "posts" && !articleRow) {
      log.warn(`posts/${file.relPath} 在 ${ARTICLES_TABLE} 表中无对应记录，双语正文为空`);
    }
    if (collection === "posts" && articleRow) {
      log.process(`合并双语正文: ${file.relPath} ← fetchedAt=${articleRow.fetchedAt} translatedAt=${articleRow.translatedAt || "-"} (${articleRow.originalContent.length}/${articleRow.translatedContent.length} 字符)`);
    }
    return buildRecord(collection, file, articleRow);
  });

  const postsRecords = built.filter((record) => record.collection === "posts");
  const emptyBodies = postsRecords.filter((record) => !record.originalBody && !record.translatedBody);
  if (emptyBodies.length > 0) {
    log.warn(`${emptyBodies.length} 篇 posts 无双语正文: ${emptyBodies.map((r) => r.path).join(", ")}`);
  }

  if (dryRun) {
    log.skip("dry-run 模式，不写入数据库");
    log.summary({
      ...counts,
      "合计": built.length,
      "跳过（私人笔记）": skipped.length,
      "posts 双语正文完整": `${postsRecords.length - emptyBodies.length}/${postsRecords.length}`,
    });
    return;
  }

  /*-- 4. 写入 content 表（按 collection + path 先删后插） --*/
  const table = await ensureContentTable(db);
  log.database("数据库连接成功，开始写入...");
  for (let idx = 0; idx < built.length; idx++) {
    const record = built[idx];
    log.process(`[${idx + 1}/${built.length}] ${record.collection}/${record.path}`);
    await upsertRecord(table, record);
  }

  /*-- 5. 回读校验：各集合条数、发布态、私人笔记不在表中 --*/
  const rows = await table.query().toArray();
  const byCollection = {};
  let published = 0;
  for (const row of rows) {
    byCollection[row.collection] = (byCollection[row.collection] || 0) + 1;
    if (row.status === "published") published += 1;
  }
  log.section("content 表回读");
  for (const [collection, count] of Object.entries(byCollection).sort()) {
    log.check(`${collection}: ${count} 条`);
  }
  /*-- 表行还原为相对 src/content 的路径（集合目录 + path + .md），与排除清单比对 --*/
  const rowToContentPath = (row) => `${COLLECTIONS[row.collection] || row.collection}/${row.path}.md`;
  const privateInTable = rows.filter((row) => PRIVATE_EXCLUDED.has(rowToContentPath(row)));
  if (privateInTable.length > 0) {
    throw new Error(`私人笔记被写入 content 表: ${privateInTable.map((r) => `${r.collection}/${r.path}`).join(", ")}`);
  }
  log.success(`私人笔记未入表（排除清单命中 ${skipped.length} 条已跳过）`);
  log.summary({
    ...byCollection,
    "合计": rows.length,
    "status: published": published,
    "posts 双语正文完整": `${postsRecords.length - emptyBodies.length}/${postsRecords.length}`,
  });
  log.success("迁移完成");
}

main().catch((err) => {
  log.error(`脚本执行失败: ${err.message}`);
  process.exit(1);
});
