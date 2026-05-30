#!/usr/bin/env node
/**
 * 脚本维护工具
 * 用于诊断和修复 LanceDB 数据库问题
 *
 * 用法：
 *   node scripts/maintenance.mjs status      # 检查数据库状态
 *   node scripts/maintenance.mjs fix         # 修复损坏的表
 *   node scripts/maintenance.mjs reset       # 重置所有表（危险）
 *   node scripts/maintenance.mjs verify      # 验证所有脚本依赖
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
const ARTICLES_TABLE = "articles";

/*===== LanceDB 操作 =====*/

async function getDb() {
  const dbUri = path.join(process.cwd(), LOCAL_DB_PATH);
  return lancedb.connect(dbUri);
}

async function checkTableHealth(db, tableName) {
  try {
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      return { exists: false, healthy: false, error: "表不存在" };
    }

    const table = await db.openTable(tableName);
    const rows = await table.query().limit(1).toArray();
    
    const expectedFields = ["id", "collection", "slug", "title", "content", "url", "vector"];
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
    "SF_TOKEN", "GLM_API_KEY"
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

  // 检查 LanceDB 表
  log.database("LanceDB 表:");
  try {
    const db = await getDb();
    
    const blogIndexStatus = await checkTableHealth(db, BLOG_INDEX_TABLE);
    if (blogIndexStatus.healthy) {
      log.success(`${BLOG_INDEX_TABLE}: 健康 (${blogIndexStatus.rowCount} 条记录)`);
      if (blogIndexStatus.schema.length > 0) {
        log.info(`Schema: ${blogIndexStatus.schema.join(", ")}`);
      }
    } else if (blogIndexStatus.exists) {
      log.error(`${BLOG_INDEX_TABLE}: ${blogIndexStatus.error}`);
      if (blogIndexStatus.missingFields) {
        log.info(`缺少字段: ${blogIndexStatus.missingFields.join(", ")}`);
        log.info(`运行 'npm run maintenance:fix' 修复`);
      }
    } else {
      log.warn(`${BLOG_INDEX_TABLE}: 不存在`);
    }

    const articlesStatus = await checkTableHealth(db, ARTICLES_TABLE);
    if (articlesStatus.healthy) {
      log.success(`${ARTICLES_TABLE}: 健康 (${articlesStatus.rowCount} 条记录)`);
    } else if (articlesStatus.exists) {
      log.error(`${ARTICLES_TABLE}: ${articlesStatus.error}`);
    } else {
      log.warn(`${ARTICLES_TABLE}: 不存在`);
    }
  } catch (error) {
    log.error(`连接 LanceDB 失败: ${error.message}`);
  }
}

async function fix() {
  log.start("修复损坏的表");
  log.divider();

  try {
    const db = await getDb();
    const tableNames = await db.tableNames();

    // 修复 blog_index 表
    if (tableNames.includes(BLOG_INDEX_TABLE)) {
      const blogIndexStatus = await checkTableHealth(db, BLOG_INDEX_TABLE);
      if (!blogIndexStatus.healthy) {
        log.fix(`删除损坏的 ${BLOG_INDEX_TABLE} 表...`);
        await db.dropTable(BLOG_INDEX_TABLE);
        log.success(`${BLOG_INDEX_TABLE} 已删除，下次 init-db 会重建`);
      } else {
        log.success(`${BLOG_INDEX_TABLE} 健康，无需修复`);
      }
    }

    // 修复 articles 表
    if (tableNames.includes(ARTICLES_TABLE)) {
      const articlesStatus = await checkTableHealth(db, ARTICLES_TABLE);
      if (!articlesStatus.healthy) {
        log.fix(`删除损坏的 ${ARTICLES_TABLE} 表...`);
        await db.dropTable(ARTICLES_TABLE);
        log.success(`${ARTICLES_TABLE} 已删除，下次 fetch-articles 会重建`);
      } else {
        log.success(`${ARTICLES_TABLE} 健康，无需修复`);
      }
    }

    log.success("修复完成");
  } catch (error) {
    log.error(`修复失败: ${error.message}`);
  }
}

async function reset() {
  log.warn("警告：此操作将删除所有 LanceDB 表");
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
      log.delete(`删除表: ${tableName}`);
      await db.dropTable(tableName);
    }

    log.success("所有表已删除");
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
      console.log("  fix      修复损坏的表");
      console.log("  reset    重置所有表（需要 --confirm）");
      console.log("  verify   验证所有脚本依赖");
  }
}

main().catch((error) => {
  log.error(`执行失败: ${error.message}`);
  process.exit(1);
});
