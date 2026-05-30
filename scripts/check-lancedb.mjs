#!/usr/bin/env node
/**
 * LanceDB 数据检查脚本
 * 直接检查 LanceDB 中的数据
 */

import * as lancedb from "@lancedb/lancedb";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const TABLE_NAME = process.env.LANCEDB_TABLE || "blog_index";
const LOCAL_DB_PATH = process.env.LANCEDB_LOCAL_PATH || ".lancedb";

async function checkLanceDB() {
  console.log("🔍 检查 LanceDB 数据...\n");

  // 检查环境变量
  const { LANCEDB_URI, LANCEDB_API_KEY } = process.env;
  
  if (LANCEDB_URI && LANCEDB_API_KEY) {
    console.log("☁️ 连接 LanceDB Cloud...");
    try {
      const db = await lancedb.connect(LANCEDB_URI, { apiKey: LANCEDB_API_KEY });
      const tableNames = await db.tableNames();
      console.log(`✅ 云数据库连接成功`);
      console.log(`📦 表列表: ${tableNames.join(", ")}\n`);

      if (tableNames.includes(TABLE_NAME)) {
        const table = await db.openTable(TABLE_NAME);
        const rows = await table.query().limit(10).toArray();
        console.log(`✅ ${TABLE_NAME} 表存在`);
        console.log(`📊 数据量: ${rows.length} 条记录（查询限制 10 条）`);
        
        if (rows.length > 0) {
          console.log("\n📋 字段列表:");
          console.log(`   ${Object.keys(rows[0]).join(", ")}`);
          
          console.log("\n📦 数据示例:");
          for (const row of rows.slice(0, 3)) {
            console.log(`   - ID: ${row.id || "N/A"}`);
            console.log(`     标题: ${row.title || "N/A"}`);
            console.log(`     集合: ${row.collection || "N/A"}`);
            console.log(`     向量: ${row.vector ? `${row.vector.length} 维` : "无"}`);
            console.log("");
          }
        } else {
          console.log("⚠️ 表为空，没有数据");
        }
      } else {
        console.log(`⚠️ ${TABLE_NAME} 表不存在`);
      }

      // 检查 articles 表
      if (tableNames.includes("articles")) {
        const articlesTable = await db.openTable("articles");
        const articles = await articlesTable.query().limit(5).toArray();
        console.log(`\n✅ articles 表存在`);
        console.log(`📊 数据量: ${articles.length} 条记录`);
      }

    } catch (error) {
      console.log(`❌ 云数据库连接失败: ${error.message}`);
    }
  }

  // 检查本地数据库
  console.log("\n📂 检查本地数据库...");
  const localDbPath = path.join(process.cwd(), LOCAL_DB_PATH);
  try {
    const db = await lancedb.connect(localDbPath);
    const tableNames = await db.tableNames();
    console.log(`✅ 本地数据库连接成功`);
    console.log(`📦 表列表: ${tableNames.join(", ")}`);

    if (tableNames.includes(TABLE_NAME)) {
      const table = await db.openTable(TABLE_NAME);
      const rows = await table.query().limit(10).toArray();
      console.log(`✅ ${TABLE_NAME} 表存在`);
      console.log(`📊 数据量: ${rows.length} 条记录`);
    }
  } catch (error) {
    console.log(`⚠️ 本地数据库: ${error.message}`);
  }
}

checkLanceDB().catch(console.error);
