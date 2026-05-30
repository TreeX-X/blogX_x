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

dotenv.config();

const args = process.argv.slice(2);
const command = args[0] || "status";

const LOCAL_DB_PATH = process.env.LANCEDB_LOCAL_PATH || ".lancedb";
const BLOG_INDEX_TABLE = process.env.LANCEDB_TABLE || "blog_index";
const ARTICLES_TABLE = "articles";

/*===== 颜色输出 =====*/
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(color, icon, message) {
  console.log(`${color}${icon}${colors.reset} ${message}`);
}

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
    
    /*-- 检查 schema 是否匹配 --*/
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
  log(colors.blue, "📊", "数据库状态检查");
  console.log("─".repeat(50));

  // 检查本地数据库目录
  const dbPath = path.join(process.cwd(), LOCAL_DB_PATH);
  if (!fs.existsSync(dbPath)) {
    log(colors.yellow, "⚠️", `本地数据库目录不存在: ${LOCAL_DB_PATH}`);
  } else {
    log(colors.green, "✅", `本地数据库目录: ${dbPath}`);
  }

  // 检查环境变量
  console.log("\n📋 环境变量:");
  const envVars = [
    "LANCEDB_URI", "LANCEDB_API_KEY", "LANCEDB_TABLE", "LANCEDB_LOCAL_PATH",
    "SF_TOKEN", "GLM_API_KEY"
  ];
  for (const varName of envVars) {
    const value = process.env[varName];
    if (value) {
      const masked = value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : "***";
      log(colors.green, "✅", `${varName}: ${masked}`);
    } else {
      log(colors.yellow, "⚠️", `${varName}: 未设置`);
    }
  }

  // 检查 LanceDB 表
  console.log("\n📦 LanceDB 表:");
  try {
    const db = await getDb();
    
    const blogIndexStatus = await checkTableHealth(db, BLOG_INDEX_TABLE);
    if (blogIndexStatus.healthy) {
      log(colors.green, "✅", `${BLOG_INDEX_TABLE}: 健康 (${blogIndexStatus.rowCount} 条记录)`);
      if (blogIndexStatus.schema.length > 0) {
        console.log(`   Schema: ${blogIndexStatus.schema.join(", ")}`);
      }
    } else if (blogIndexStatus.exists) {
      log(colors.red, "❌", `${BLOG_INDEX_TABLE}: ${blogIndexStatus.error}`);
      if (blogIndexStatus.missingFields) {
        console.log(`   缺少字段: ${blogIndexStatus.missingFields.join(", ")}`);
        console.log(`   运行 'npm run maintenance:fix' 修复`);
      }
    } else {
      log(colors.yellow, "⚠️", `${BLOG_INDEX_TABLE}: 不存在`);
    }

    const articlesStatus = await checkTableHealth(db, ARTICLES_TABLE);
    if (articlesStatus.healthy) {
      log(colors.green, "✅", `${ARTICLES_TABLE}: 健康 (${articlesStatus.rowCount} 条记录)`);
    } else if (articlesStatus.exists) {
      log(colors.red, "❌", `${ARTICLES_TABLE}: ${articlesStatus.error}`);
    } else {
      log(colors.yellow, "⚠️", `${ARTICLES_TABLE}: 不存在`);
    }
  } catch (error) {
    log(colors.red, "❌", `连接 LanceDB 失败: ${error.message}`);
  }
}

async function fix() {
  log(colors.blue, "🔧", "修复损坏的表");
  console.log("─".repeat(50));

  try {
    const db = await getDb();
    const tableNames = await db.tableNames();

    // 修复 blog_index 表
    if (tableNames.includes(BLOG_INDEX_TABLE)) {
      const blogIndexStatus = await checkTableHealth(db, BLOG_INDEX_TABLE);
      if (!blogIndexStatus.healthy) {
        log(colors.yellow, "🔄", `删除损坏的 ${BLOG_INDEX_TABLE} 表...`);
        await db.dropTable(BLOG_INDEX_TABLE);
        log(colors.green, "✅", `${BLOG_INDEX_TABLE} 已删除，下次 init-db 会重建`);
      } else {
        log(colors.green, "✅", `${BLOG_INDEX_TABLE} 健康，无需修复`);
      }
    }

    // 修复 articles 表
    if (tableNames.includes(ARTICLES_TABLE)) {
      const articlesStatus = await checkTableHealth(db, ARTICLES_TABLE);
      if (!articlesStatus.healthy) {
        log(colors.yellow, "🔄", `删除损坏的 ${ARTICLES_TABLE} 表...`);
        await db.dropTable(ARTICLES_TABLE);
        log(colors.green, "✅", `${ARTICLES_TABLE} 已删除，下次 fetch-articles 会重建`);
      } else {
        log(colors.green, "✅", `${ARTICLES_TABLE} 健康，无需修复`);
      }
    }

    log(colors.green, "✅", "修复完成");
  } catch (error) {
    log(colors.red, "❌", `修复失败: ${error.message}`);
  }
}

async function reset() {
  log(colors.red, "⚠️", "警告：此操作将删除所有 LanceDB 表");
  console.log("─".repeat(50));

  // 简单确认
  const confirmArg = args.find(a => a === "--confirm");
  if (!confirmArg) {
    log(colors.yellow, "💡", "添加 --confirm 参数确认执行");
    return;
  }

  try {
    const db = await getDb();
    const tableNames = await db.tableNames();

    for (const tableName of tableNames) {
      log(colors.yellow, "🗑️", `删除表: ${tableName}`);
      await db.dropTable(tableName);
    }

    log(colors.green, "✅", "所有表已删除");
  } catch (error) {
    log(colors.red, "❌", `重置失败: ${error.message}`);
  }
}

async function verify() {
  log(colors.blue, "🔍", "验证脚本依赖");
  console.log("─".repeat(50));

  const checks = [
    { name: "gray-matter", type: "npm" },
    { name: "@mozilla/readability", type: "npm" },
    { name: "linkedom", type: "npm" },
    { name: "@lancedb/lancedb", type: "npm" },
    { name: "dotenv", type: "npm" },
  ];

  for (const check of checks) {
    try {
      await import(check.name);
      log(colors.green, "✅", `${check.name}: 可用`);
    } catch (error) {
      log(colors.red, "❌", `${check.name}: 不可用 - ${error.message}`);
    }
  }

  // 检查脚本文件
  console.log("\n📜 脚本文件:");
  const scripts = [
    "scripts/init-db.mjs",
    "scripts/fetch-articles.mjs",
    "scripts/sync-obsidian-kb.mjs",
    "scripts/setup-git-hooks.mjs",
  ];

  for (const script of scripts) {
    if (fs.existsSync(script)) {
      log(colors.green, "✅", `${script}: 存在`);
    } else {
      log(colors.red, "❌", `${script}: 不存在`);
    }
  }
}

/*===== 主程序 =====*/

async function main() {
  console.log("\n🛠️  脚本维护工具\n");

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
      console.log("用法: node scripts/maintenance.mjs <command>");
      console.log("\n可用命令:");
      console.log("  status   检查数据库状态");
      console.log("  fix      修复损坏的表");
      console.log("  reset    重置所有表（需要 --confirm）");
      console.log("  verify   验证所有脚本依赖");
  }
}

main().catch((error) => {
  log(colors.red, "💥", `执行失败: ${error.message}`);
  process.exit(1);
});
