#!/usr/bin/env node
/**
 * 脚本维护工具
 * 用于诊断和修复 LanceDB 数据库问题
 *
 * 表的口径（T5，内容真相源迁到 content 表之后）：
 * - `content`：内容唯一真源。健康检查必须查它；任何"表坏了就删"的自动修复都不允许用在它
 *   身上——删掉它等于删掉全部内容，且没有重建路径（blog_index 有 init-db 兜底，content 没有）。
 * - `blog_index`：内容派生索引，删了 init-db 会重建，所以 fix 对它照旧"坏就删"。
 * - `articles`：已废弃。站点侧零读取方，本工具不再检查它，见下方 Known items。
 *
 * 连接口径：
 * - status 额外只读探测云端 content 表（真源在云端，只查本地库会永远报"表不存在"）；
 * - fix / reset 只连本地库。钩子里的 maintenance:fix 因此不会因为 LanceDB Cloud 不可达
 *   而挡住 git push，也不会往共享的云端表里写东西。
 *
 * 用法：
 *   node scripts/maintenance.mjs status      # 检查数据库状态
 *   node scripts/maintenance.mjs fix         # 修复损坏的表（只修派生索引，绝不删 content）
 *   node scripts/maintenance.mjs reset       # 重置本地表（需要 --confirm，不碰 content）
 *   node scripts/maintenance.mjs verify      # 验证所有脚本依赖
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 */

import fs from "node:fs";
import path from "node:path";
import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";

dotenv.config();

const log = new Logger("maintenance");
const args = process.argv.slice(2);
const command = args[0] || "status";

const LOCAL_DB_PATH = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
const BLOG_INDEX_TABLE = process.env.LANCEDB_TABLE || "blog_index";
const CONTENT_TABLE = "content";

/*-- 各表的必填字段：content 是内容真源，字段缺一个就意味着这份库不是我们以为的那份 --*/
const EXPECTED_FIELDS = {
  [BLOG_INDEX_TABLE]: ["id", "collection", "slug", "title", "content", "url", "vector"],
  [CONTENT_TABLE]: [
    "collection", "path", "frontmatter", "body",
    "originalBody", "translatedBody", "status", "updatedAt",
  ],
};

/*===== LanceDB 操作 =====*/

async function getDb() {
  const dbUri = path.join(process.cwd(), LOCAL_DB_PATH);
  return lancedb.connect(dbUri);
}

async function checkTableHealth(db, tableName) {
  const expectedFields = EXPECTED_FIELDS[tableName];
  try {
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      return { exists: false, healthy: false, error: "表不存在" };
    }

    const table = await db.openTable(tableName);
    const rows = await table.query().limit(1).toArray();

    if (!expectedFields) {
      return { exists: true, healthy: true, rowCount: rows.length, schema: Object.keys(rows[0] || {}) };
    }

    const actualFields = rows.length > 0 ? Object.keys(rows[0]) : [];
    const missingFields = expectedFields.filter(f => !actualFields.includes(f));

    if (missingFields.length > 0) {
      return {
        exists: true,
        healthy: false,
        error: `Schema 不匹配，缺少字段: ${missingFields.join(", ")}`,
        schema: actualFields,
        missingFields
      };
    }

    return {
      exists: true,
      healthy: true,
      rowCount: rows.length,
      schema: actualFields
    };
  } catch (error) {
    return { exists: true, healthy: false, error: error.message };
  }
}

/**
 * 只读探测云端 content 表。
 * 单独 connect 而不复用 getDb()：本模块其余部分刻意只连本地库（见文件头"连接口径"），
 * 这里只是一个读探针，失败只影响报告，不影响任何命令的退出码。
 */
async function checkCloudContent() {
  const { LANCEDB_URI, LANCEDB_API_KEY } = process.env;
  if (!LANCEDB_URI || !LANCEDB_API_KEY) {
    return { skipped: true, reason: "LANCEDB_URI / LANCEDB_API_KEY 未设置" };
  }
  try {
    const db = await lancedb.connect(LANCEDB_URI, { apiKey: LANCEDB_API_KEY });
    const tableNames = await db.tableNames();
    if (!tableNames.includes(CONTENT_TABLE)) {
      return { exists: false, healthy: false, error: "云端 content 表不存在" };
    }
    const table = await db.openTable(CONTENT_TABLE);
    const rows = await table.query().toArray();
    const byCollection = {};
    for (const row of rows) {
      byCollection[row.collection] = (byCollection[row.collection] || 0) + 1;
    }
    return { exists: true, healthy: true, rowCount: rows.length, byCollection };
  } catch (error) {
    return { exists: true, healthy: false, error: error.message };
  }
}

function reportHealth(name, status, options = {}) {
  if (status.healthy) {
    log.success(`${name}: 健康 (${status.rowCount} 条记录)`);
    if (status.schema && status.schema.length > 0) {
      log.info(`Schema: ${status.schema.join(", ")}`);
    }
    return;
  }
  if (status.exists) {
    log.error(`${name}: ${status.error}`);
    if (status.missingFields) {
      log.info(`缺少字段: ${status.missingFields.join(", ")}`);
      if (options.repairHint) log.info(options.repairHint);
    }
  } else {
    log.warn(`${name}: ${status.error || "不存在"}`);
  }
}

/*===== 命令处理 =====*/

async function status() {
  log.start("数据库状态检查");
  log.divider();

  // 检查本地数据库目录
  const dbPath = path.join(process.cwd(), LOCAL_DB_PATH);
  if (!fs.existsSync(dbPath)) {
    log.warn(`本地数据库目录不存在: ${LOCAL_DB_PATH}`);
  } else {
    log.success(`本地数据库目录: ${dbPath}`);
  }

  // 检查环境变量
  log.config("环境变量:");
  const envVars = [
    "LANCEDB_URI", "LANCEDB_API_KEY", "LANCEDB_TABLE", "LANCEDB_LOCAL_PATH",
    "SF_TOKEN", "LLM_API_KEY"
  ];
  for (const varName of envVars) {
    const value = process.env[varName];
    if (value) {
      const masked = value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : "***";
      log.success(`${varName}: ${masked}`);
    } else {
      log.warn(`${varName}: 未设置`);
    }
  }

  // 检查本地 LanceDB 表（派生索引）
  log.database("本地 LanceDB 表:");
  try {
    const db = await getDb();
    reportHealth(BLOG_INDEX_TABLE, await checkTableHealth(db, BLOG_INDEX_TABLE), {
      repairHint: "运行 'npm run maintenance:fix' 修复",
    });
  } catch (error) {
    log.error(`连接 LanceDB 失败: ${error.message}`);
  }

  // 检查云端 content 表（内容真源）
  log.database("云端 content 表（内容真源）:");
  const cloud = await checkCloudContent();
  if (cloud.skipped) {
    log.warn(`跳过云端探测: ${cloud.reason}`);
  } else if (cloud.healthy) {
    log.success(`${CONTENT_TABLE}: 健康 (${cloud.rowCount} 条记录)`);
    const detail = Object.entries(cloud.byCollection || {})
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([collection, count]) => `${collection} ${count}`)
      .join(" · ");
    log.info(`集合分布: ${detail}`);
  } else if (cloud.exists) {
    log.error(`${CONTENT_TABLE}: ${cloud.error}`);
  } else {
    log.warn(`${CONTENT_TABLE}: ${cloud.error}`);
  }

  log.info("articles 表已废弃（站点侧零读取方），本工具不再检查它");
}

async function fix() {
  log.start("修复损坏的表");
  log.divider();

  try {
    const db = await getDb();
    const tableNames = await db.tableNames();

    /*-- 派生索引：坏了就删，init-db 会重建（原行为，保持不变）--*/
    if (tableNames.includes(BLOG_INDEX_TABLE)) {
      const health = await checkTableHealth(db, BLOG_INDEX_TABLE);
      if (!health.healthy) {
        log.fix(`删除损坏的 ${BLOG_INDEX_TABLE} 表...`);
        await db.dropTable(BLOG_INDEX_TABLE);
        log.success(`${BLOG_INDEX_TABLE} 已删除，下次 init-db 会重建`);
      } else {
        log.success(`${BLOG_INDEX_TABLE} 健康，无需修复`);
      }
    }

    /*-- 内容真源：检查，但绝不自动删。删了没有重建路径，且删的是全部内容 --*/
    if (tableNames.includes(CONTENT_TABLE)) {
      const health = await checkTableHealth(db, CONTENT_TABLE);
      if (health.healthy) {
        log.success(`${CONTENT_TABLE} 健康，无需修复`);
      } else {
        log.error(`${CONTENT_TABLE} ${health.error} — 不自动删除`);
        log.info(
          `${CONTENT_TABLE} 是内容唯一真源，没有重建路径（blog_index 删了有 init-db 兜底，它没有）。` +
            "本地这份只是降级缓存，真源在云端：请检查 .env 的 LANCEDB_URI / LANCEDB_API_KEY 与云端表状态，" +
            "确认要放弃本地缓存再手动删除本地库目录。"
        );
      }
    }

    log.success("修复完成");
  } catch (error) {
    log.error(`修复失败: ${error.message}`);
  }
}

async function reset() {
  log.warn("警告：此操作将删除本地 LanceDB 表");
  log.divider();

  const confirmArg = args.find(a => a === "--confirm");
  if (!confirmArg) {
    log.info("添加 --confirm 参数确认执行");
    return;
  }

  try {
    const db = await getDb();
    const tableNames = await db.tableNames();

    for (const tableName of tableNames) {
      /*-- content 不参与重置：它是内容真源的降级缓存，删掉后离线 dev 连旧内容都没有，
           而云端不可达时这份缓存是唯一还能启动的那一份 --*/
      if (tableName === CONTENT_TABLE) {
        log.skip(`${tableName}: 内容真源，不参与 reset（如确认要放弃本地缓存，请手动删除本地库目录）`);
        continue;
      }
      log.delete(`删除表: ${tableName}`);
      await db.dropTable(tableName);
    }

    log.success("重置完成（content 表已保留）");
  } catch (error) {
    log.error(`重置失败: ${error.message}`);
  }
}

async function verify() {
  log.start("验证脚本依赖");
  log.divider();

  const checks = [
    { name: "gray-matter", type: "npm" },
    { name: "@mozilla/readability", type: "npm" },
    { name: "linkedom", type: "npm" },
    { name: "@lancedb/lancedb", type: "npm" },
    { name: "dotenv", type: "npm" },
  ];

  log.script("NPM 依赖:");
  for (const check of checks) {
    try {
      await import(check.name);
      log.success(`${check.name}: 可用`);
    } catch (error) {
      log.error(`${check.name}: 不可用 - ${error.message}`);
    }
  }

  log.file("脚本文件:");
  const scripts = [
    "scripts/init-db.mjs",
    "scripts/fetch-articles.mjs",
    "scripts/sync-obsidian-kb.mjs",
    "scripts/setup-git-hooks.mjs",
    "scripts/maintenance.mjs",
  ];

  for (const script of scripts) {
    if (fs.existsSync(script)) {
      log.success(`${script}: 存在`);
    } else {
      log.error(`${script}: 不存在`);
    }
  }
}

/*===== 主程序 =====*/

async function main() {
  log.start("脚本维护工具");
  console.log("");

  switch (command) {
    case "status":
      await status();
      break;
    case "fix":
      await fix();
      break;
    case "reset":
      await reset();
      break;
    case "verify":
      await verify();
      break;
    default:
      log.info("用法: node scripts/maintenance.mjs <command>");
      console.log("\n可用命令:");
      console.log("  status   检查数据库状态");
      console.log("  fix      修复损坏的表（只修派生索引，不删 content）");
      console.log("  reset    重置本地表（需要 --confirm，不碰 content）");
      console.log("  verify   验证所有脚本依赖");
  }
}

main().catch((error) => {
  log.error(`执行失败: ${error.message}`);
  process.exit(1);
});
