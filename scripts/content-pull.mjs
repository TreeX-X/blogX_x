#!/usr/bin/env node
/**
 * 构建期内容拉取：LanceDB `content` 表 → src/content/**
 *
 * content 表是内容唯一真源，src/content/** 已移出 git 成为构建产物：prebuild / predev
 * 先跑本脚本，把 status: published 的记录按原嵌套路径写盘并生成 frontmatter，
 * src/content.config.ts 的 glob loader 与全部页面零改动即可构建。status: draft 只
 * 存在于 content 表，不写盘。
 *
 * 先清空再写入是硬要求：src/content/** 是构建产物，残留文件会被 glob loader 收进来
 * 并可能使整个构建失败（实例见 T1 的 Known items——一篇被本地钩子同步进来的私人笔记
 * 引用不存在的图片，令 astro build 抛 ImageNotFound）。清空范围限 src/content 下六个
 * 集合目录，不碰 src/content.config.ts，也不碰 src/content 之外的任何路径。
 *
 * 降级：LanceDB 不可达或表为空时 listCollection 返回空数组，本脚本不写盘也不清空，让本地
 * dev / 构建继续用上次拉取的磁盘内容启动（需求 AC-8 的构建与降级部分）。但"磁盘上也没有任何
 * 内容"时不再降级：那意味着本次构建无论成功与否都产出零内容页，静默放行只会把一个空站点
 * 推上线，必须响亮失败（见下方 retained 判据）。查询与连接一律走 content-store，本脚本不重复实现。
 *
 * 用法：
 *   node scripts/content-pull.mjs   # prebuild / predev 自动调用，也可手动执行
 *
 * 幂等性：清空后全量重写，重复执行磁盘内容恒定；与 content 表的差异（含残留文件）被清掉。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 * Note: 内容移出仓库、构建期从 LanceDB 拉取写盘 — see .agents/notes/2026-10-05-decision-content-out-of-repo--a23b0b97.md
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";
import { listCollection } from "../src/lib/content-store.ts";

/*-- content-store 在调用时才读 process.env，故 dotenv.config() 必须在任何查询之前 --*/
dotenv.config();

const log = new Logger("content-pull");

/*===== 配置常量 =====*/
const CONTENT_ROOT = "src/content";

/*-- 集合键 → 目录。键必须与 src/content.config.ts 的集合键一致：
     内容云按这两个字段寻址，写盘时据此把记录映射回目录。改集合必须同步改这里 --*/
const COLLECTIONS = {
  posts: "posts",
  knowledgeBase: "knowledge-base",
  wiki: "wiki",
  repos: "repos",
  skills: "skills",
  projects: "projects",
};

/*===== 工具函数 =====*/

/**
 * 记录 path → 集合目录下的绝对文件路径（固定追加 .md）。
 * path 为集合内相对路径，正斜杠分隔，可含中文、全角冒号、圆括号、空格与嵌套目录。
 * 越界（`../` 穿越导致写出集合目录）属于数据错误，必须让构建失败而不是静默写到仓库外。
 */
function resolveTarget(collectionDir, recordPath) {
  const segments = String(recordPath).split("/").filter((s) => s && s !== ".");
  const base = path.resolve(CONTENT_ROOT, collectionDir);
  const target = path.resolve(base, ...segments);
  const rel = path.relative(base, target);
  if (rel === "" || rel === ".." || rel.startsWith(`..${path.sep}`)) {
    throw new Error(`path 越出集合目录，已中止: ${collectionDir}/${recordPath}`);
  }
  return `${target}.md`;
}

/*-- 递归统计集合目录下的 .md 文件数，用于写盘后回读校验 --*/
function countMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countMarkdownFiles(path.join(dir, entry.name));
    } else if (entry.name.endsWith(".md")) {
      count += 1;
    }
  }
  return count;
}

/*===== 主流程 =====*/

async function main() {
  log.start("内容拉取脚本启动（content 表 → src/content）");

  /*-- 1. 从 content 表拉取全部集合，只留 published --*/
  const published = {};
  let total = 0;
  let drafts = 0;
  for (const [collection, dir] of Object.entries(COLLECTIONS)) {
    const records = await listCollection(collection);
    published[collection] = records.filter((record) => record.status === "published");
    drafts += records.length - published[collection].length;
    total += published[collection].length;
    log.file(`${collection}: ${published[collection].length} 条 → ${path.join(CONTENT_ROOT, dir)}`);
  }
  log.info(`待写盘记录: ${total} 条（跳过 draft ${drafts} 条）`);

  /*-- 2. 降级：一条都没拉到（LanceDB 不可达或表为空）时保留磁盘现状。
         保留多少个文件必须说出来：静默降级会把"表被清空"表现为站点内容不更新 --*/
  if (total === 0) {
    const retained = Object.values(COLLECTIONS)
      .reduce((sum, dir) => sum + countMarkdownFiles(path.join(CONTENT_ROOT, dir)), 0);

    /*-- 什么可服务的都没有时不许降级：content 表是唯一真源，拉不到 0 条又没有旧内容退避，
           整条构建链下游没有一环会对空内容失败（init-db 早退、glob-loader 只警告、astro build
           照常完成），结果是 exit 0 + 零内容页的空站点——失败是响的，空站是静的。新机器 clone
           下来 src/content 本就是构建产物、目录为空，此刻 LanceDB 再不可达即属此种情形。 --*/
    if (retained === 0) {
      throw new Error(
        "未从 content 表拉到 published 记录，且 src/content 下没有可退避的既有内容（0 个 .md），构建中止。" +
          "请检查 .env 的 LANCEDB_URI / LANCEDB_API_KEY 与 content 表的实际行数（表可能为空、或凭据/网络不可达）。",
      );
    }

    log.warn("未从 content 表拉到 published 记录，本次不写盘、不清空");
    log.warn(`保留 src/content 现有 ${retained} 个 .md（可能是上次拉取的内容，也可能表里确实只有草稿）`);
    log.warn("请检查 .env 的 LANCEDB_URI / LANCEDB_API_KEY 与 content 表的实际行数");
    return;
  }

  /*-- 3. 先清空再写入：六个集合目录整目录删除后重建，残留文件（钩子同步的私人笔记、
        手放的探针文件等）一律被清掉 --*/
  for (const dir of Object.values(COLLECTIONS)) {
    const collectionDir = path.join(CONTENT_ROOT, dir);
    fs.rmSync(collectionDir, { recursive: true, force: true });
    fs.mkdirSync(collectionDir, { recursive: true });
  }
  log.delete(`已清空并重建六个集合目录（${CONTENT_ROOT}/{${Object.values(COLLECTIONS).join(",")}}）`);

  /*-- 4. 写盘：frontmatter 由记录的 JSON 反序列化后交 gray-matter 序列化为 YAML
        （与 fetch-articles、sync-obsidian-kb 同一序列化器），body 原样写在其后 --*/
  for (const [collection, dir] of Object.entries(COLLECTIONS)) {
    for (const record of published[collection]) {
      const target = resolveTarget(dir, record.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, matter.stringify(record.body, JSON.parse(record.frontmatter)), "utf-8");
    }
    log.save(`${collection}: ${published[collection].length} 条已写入`);
  }

  /*-- 5. 回读校验：磁盘条数与拉取条数逐集合一致 --*/
  log.section("src/content 回读");
  for (const [collection, dir] of Object.entries(COLLECTIONS)) {
    const onDisk = countMarkdownFiles(path.join(CONTENT_ROOT, dir));
    const expected = published[collection].length;
    if (onDisk !== expected) {
      throw new Error(`${collection} 写盘后条数不符: 磁盘 ${onDisk} ≠ 拉取 ${expected}`);
    }
    log.check(`${collection}: ${onDisk} 条`);
  }

  log.summary({
    ...Object.fromEntries(Object.entries(COLLECTIONS).map(([c]) => [c, published[c].length])),
    "合计": total,
    "draft（不写盘）": drafts,
  });
  log.success(`内容拉取完成：${total} 条 → ${CONTENT_ROOT}`);
}

main().catch((err) => {
  log.error(`脚本执行失败: ${err.message}`);
  process.exit(1);
});
