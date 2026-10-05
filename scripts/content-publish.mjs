#!/usr/bin/env node
/**
 * 草稿发布（CLI）：content-schemas 校验 → status: published → 触发 Vercel 重建
 *
 * 顺序是"先入表、再触发重建"：content 表是内容唯一真源，置为 published 才让这条记录进入
 * 下一次 content-pull 的写盘集合；Deploy Hook 失败时内容已在表里，脚本报错退出并说明站点
 * 未重建——宁可响亮的半成品，也不要"提示成功但线上没变"。
 *
 * Deploy Hook 由 VERCEL_DEPLOY_HOOK 提供（.env，值到 Vercel 项目 → Settings → Git →
 * Deploy Hooks 创建）。变量缺失不阻断发布：内容已入表，只是站点不会自动重建，脚本明确警告。
 *
 * 用法：
 *   npm run content:publish -- --collection posts --path <path>
 *   npm run content:publish -- --path <path>                  # collection 缺省 posts
 *   npm run content:publish -- --collection posts --path <path> --dry-run
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 */

import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";
import { PublishValidationError, publishIntakeDraft } from "../src/lib/article-intake.service.ts";

/*-- 服务在调用时才读 process.env（含 VERCEL_DEPLOY_HOOK），故 dotenv.config() 必须最先跑 --*/
dotenv.config();

const log = new Logger("content-publish");

const argv = process.argv.slice(2);

function flagValue(name) {
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  if (index >= 0 && index + 1 < argv.length) return argv[index + 1];
  return "";
}

const dryRun = argv.includes("--dry-run");

async function main() {
  const path = flagValue("--path").trim();
  if (!path) {
    throw new Error("缺少 --path <集合内路径>（草稿的 path，见 npm run content:intake -- --list）");
  }
  const collection = flagValue("--collection").trim() || "posts";
  log.start(`发布草稿 ${collection}/${path}${dryRun ? "（dry-run）" : ""}`);

  const report = await publishIntakeDraft(collection, path, {
    dryRun,
    onProgress: (message) => log.process(message),
  });

  report.warnings.forEach((warning) => log.warn(warning));
  if (report.published) {
    log.success(`已发布 ${report.collection}/${report.path}（status: published）`);
    log.info("下一次 content-pull（prebuild/predev）会把它写盘进站点");
  } else {
    log.info("dry-run：未改状态、未触发重建");
  }
}

main().catch((err) => {
  /*-- 字段校验失败要把逐条 issue 列出来：笼统一句"校验失败"让人不知道该改哪个字段 --*/
  if (err instanceof PublishValidationError) {
    log.error("字段校验失败，未发布（该记录状态未被改动）:");
    err.issues.forEach((issue) => log.error(`  - ${issue}`));
    log.info("修订这些字段后重试（dev 面板或手工改 frontmatter）");
    process.exit(1);
  }
  log.error(`执行失败: ${err.message}`);
  process.exit(1);
});
