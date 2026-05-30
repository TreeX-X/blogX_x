#!/usr/bin/env node
/**
 * 知识图谱 API 测试脚本
 * 测试 API 是否能正常返回数据
 */

import dotenv from "dotenv";
dotenv.config();

const API_URL = process.env.API_URL || "http://localhost:4321/api/knowledge-graph";

async function testKnowledgeGraph() {
  console.log("🧪 测试知识图谱 API...\n");
  console.log(`API URL: ${API_URL}\n`);

  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    if (!response.ok) {
      console.log("❌ API 返回错误:");
      console.log(`   状态码: ${response.status}`);
      console.log(`   错误: ${data.error || "未知错误"}`);
      return;
    }

    console.log("✅ API 响应成功\n");
    console.log("📊 数据统计:");
    console.log(`   节点数量: ${data.nodeCount || 0}`);
    console.log(`   链接数量: ${data.linkCount || 0}`);

    if (data.nodes && data.nodes.length > 0) {
      console.log("\n📦 节点示例:");
      const sampleNodes = data.nodes.slice(0, 5);
      for (const node of sampleNodes) {
        console.log(`   - ${node.title} (${node.collection})`);
      }
      if (data.nodes.length > 5) {
        console.log(`   ... 还有 ${data.nodes.length - 5} 个节点`);
      }
    }

    if (data.links && data.links.length > 0) {
      console.log("\n🔗 链接示例:");
      const sampleLinks = data.links.slice(0, 3);
      for (const link of sampleLinks) {
        console.log(`   - ${link.source} → ${link.target} (相似度: ${link.similarity?.toFixed(2) || "N/A"})`);
      }
      if (data.links.length > 3) {
        console.log(`   ... 还有 ${data.links.length - 3} 个链接`);
      }
    }

    if (data.nodeCount === 0) {
      console.log("\n⚠️ 没有节点数据，知识图谱无法显示");
      console.log("   可能原因:");
      console.log("   1. 数据库中没有数据");
      console.log("   2. API 连接失败");
      console.log("   3. 表不存在或损坏");
    } else if (data.linkCount === 0) {
      console.log("\n⚠️ 没有链接数据，知识图谱无法显示");
      console.log("   可能原因:");
      console.log("   1. 向量数据缺失");
      console.log("   2. 相似度阈值过高");
      console.log("   3. 节点数量不足");
    } else {
      console.log("\n✅ 知识图谱数据正常，应该可以显示");
    }

  } catch (error) {
    console.log("❌ 测试失败:");
    console.log(`   错误: ${error.message}`);
    console.log("\n💡 提示:");
    console.log("   1. 确保开发服务器正在运行 (npm run dev)");
    console.log("   2. 检查 API URL 是否正确");
    console.log("   3. 检查网络连接");
  }
}

testKnowledgeGraph();
