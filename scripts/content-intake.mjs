#!/usr/bin/env node
/**
 * AI 上传处理通道（CLI）：URL / 文件 / 粘贴正文 → 结构化草稿
 *
 * 产物一律是 content 表里 collection=posts、status=draft 的一条记录，含 GLM 提取的
 * frontmatter 与双语正文；草稿不进构建产物（content-pull 只写盘 status: published）。
 * 抓取、翻译、落库全部在 src/lib/article-intake.service.ts，本脚本只做参数解析与报表。
 *
 * 用法：
 *   npm run content:intake -- --url https://example.com/post
 *   npm run content:intake -- --file ./notes/post.md
 *   npm run content:intake -- --text "正文……"            （--text - 则读 stdin）
 *   npm run content:intake -- --list                     # 列草稿箱
 *   npm run content:intake -- --url <url> --dry-run      # 只打印不写库
 *   npm run content:intake -- --url <url> --json         # 结果以 JSON 输出
 *
 * file / text 输入没有外链时可加 --source-url <url>；不给则写 urn 占位并警告。
 * 发布见 scripts/content-publish.mjs（npm run content:publish）。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 * Note: 草稿态以 content 表 status 为权威口径 — see .agents/notes/2026-10-05-task-t3-admin-to-cloud--870946b7.md
 */

import fs from "node:fs";
import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";
import {
  createIntakeDraft,
  deleteIntakeDraft,
  listIntakeDrafts,
} from "../src/lib/article-intake.service.ts";

/*-- 服务在调用时才读 process.env，故 dotenv.config() 必须在任何 intake 之前 --*/
dotenv.config();

const log = new Logger("content-intake");

/*===== 参数解析 =====*/

const argv = process.argv.slice(2);

function flagValue(name) {
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  if (index >= 0 && index + 1 < argv.length) return argv[index + 1];
  return "";
}

const hasFlag = (name) => argv.includes(name);
const dryRun = hasFlag("--dry-run");
const asJson = hasFlag("--json");
const listOnly = hasFlag("--list");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

/*-- 输入三源互斥；都没给且有管道输入时按粘贴正文处理 --*/
function resolveRequest() {
  const url = flagValue("--url").trim();
  const filePath = flagValue("--file").trim();
  const textFlag = flagValue("--text");
  const text = textFlag === "-" ? readStdin() : textFlag;
  const sourceUrl = flagValue("--source-url").trim();
  const sources = [url ? "url" : "", filePath ? "file" : "", text.trim() ? "text" : ""].filter(
    Boolean
  );
  if (sources.length > 1) {
    throw new Error(`--url / --file / --text 只能给一个（收到 ${sources.join(" + ")}）`);
  }
  if (url) return { source: "url", url };
  if (filePath) return { source: "file", filePath, sourceUrl };
  if (text.trim()) return { source: "text", text, sourceUrl };
  /*-- 没给任何输入但 stdin 有内容（管道/重定向）时按正文处理 --*/
  const piped = hasFlag("--stdin") || !process.stdin.isTTY ? readStdin() : "";
  if (piped.trim()) return { source: "text", text: piped, sourceUrl };
  throw new Error("没有输入：用 --url <url> / --file <path> / --text <string> 之一，或 --list 列草稿箱");
}

/*===== 报表 =====*/

function reportDraft(draft) {
  const rec = draft.record;
  const frontmatter = draft.frontmatter;
  log.section("草稿");
  log.file(`集合: ${rec.collection}    path: ${rec.path}`);
  log.file(`status: ${rec.status}（权威口径，content-pull 只写盘 published）`);
  log.file(`sourceUrl: ${frontmatter.sourceUrl}`);
  log.file(`title: ${frontmatter.title}`);
  log.file(`date: ${frontmatter.date}`);
  log.file(`description: ${String(frontmatter.description || "").slice(0, 120)}`);
  log.file(`tags: ${(frontmatter.tags || []).join(", ") || "—"}`);
  log.file(`originalAuthor: ${frontmatter.originalAuthor || "—"}`);
  log.file(`originalLang: ${frontmatter.originalLang}`);
  log.file(
    `正文长度: originalBody ${rec.originalBody.length} / translatedBody ${rec.translatedBody.length} / body ${rec.body.length}`
  );
  draft.warnings.forEach((warning) => log.warn(`需要人工修订: ${warning}`));
  /*-- dry-run 的措辞必须和 dry-run 一致：否则同一次输出既说"已写入"又说"未改动" --*/
  if (dryRun) {
    log.save(`dry-run：未写库。写库会得到 ${rec.collection}/${rec.path}（status: draft）`);
  } else {
    log.save(`草稿已写入 content 表（${rec.collection}/${rec.path}），未发布、不进构建产物`);
    log.info("发布：npm run content:publish -- --collection posts --path " + rec.path);
  }
}

function reportList(drafts) {
  if (!drafts.length) {
    log.info("草稿箱为空");
    return;
  }
  log.table(
    ["path", "标题", "来源", "intake", "译文长度", "更新时间"],
    drafts.map((d) => [
      d.path,
      String(d.title || "").slice(0, 24),
      d.intakeSource || "—",
      d.intakeStatus === "failed" ? "⚠️ 失败" : d.intakeStatus,
      String(d.translatedBodyLength),
      d.updatedAt.slice(0, 19).replace("T", " "),
    ])
  );
}

/*===== 主流程 =====*/

async function main() {
  log.start("AI 上传处理通道（content-intake）");

  if (listOnly) {
    const drafts = await listIntakeDrafts();
    reportList(drafts);
    log.summary({ 草稿数: drafts.length });
    return;
  }

  const request = resolveRequest();
  log.config(`输入: ${request.source}${dryRun ? "（dry-run，不写库）" : ""}`);

  const draft = await createIntakeDraft(request, {
    write: !dryRun,
    onProgress: (message) => log.process(message),
  });

  if (asJson) {
    const rec = draft.record;
    console.log(
      JSON.stringify(
        {
          collection: rec.collection,
          path: rec.path,
          status: rec.status,
          frontmatter: draft.frontmatter,
          warnings: draft.warnings,
          lengths: {
            originalBody: rec.originalBody.length,
            translatedBody: rec.translatedBody.length,
            body: rec.body.length,
          },
        },
        null,
        2
      )
    );
  } else {
    reportDraft(draft);
  }

  /*-- 产物已落库即为成功退出 0；GLM 失败等原因写在草稿的 intake.warnings 里，由
        人工修订后再发布，不以非零退出把失败藏起来，也不假装无事发生 --*/
  if (draft.warnings.length && !asJson) {
    log.warn(`本次 intake 有 ${draft.warnings.length} 条警告，草稿保留待人工修订后再发布`);
  }
}

/*-- --delete <path>：草稿箱里丢弃一条草稿 --*/
if (hasFlag("--delete")) {
  const target = flagValue("--delete").trim();
  if (!target) {
    log.fail("--delete 需要一个 path");
  } else {
    await deleteIntakeDraft("posts", target);
    log.delete(`已删除草稿 posts/${target}`);
  }
} else {
  main().catch((err) => {
    log.fail(`执行失败: ${err.message}`);
  });
}
