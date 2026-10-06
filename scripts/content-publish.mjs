#!/usr/bin/env node
/**
 * 草稿发布（CLI）：intake 门禁 → content-schemas 校验 → status: published → 触发 Vercel 重建
 *
 * 顺序是"先入表、再触发重建"：content 表是内容唯一真源，置为 published 才让这条记录进入
 * 下一次 content-pull 的写盘集合；Deploy Hook 失败时内容已在表里，脚本报错退出并说明站点
 * 未重建——宁可响亮的半成品，也不要"提示成功但线上没变"。
 *
 * 发布前门禁：`intake.status === "failed"` 的草稿**默认拒绝发布**。T4 的口径是"失败必须随
 * 草稿可见"，那解决的是"看不见"，不解决"带着已知失败上线"。构建期不再为 intake 期的失败
 * 设门禁（见 fetch-articles 的退出码分情形），这个动作的门禁就落在发布期——正好是"把一篇
 * 没译完的文章推上线"被允许的那个点。
 * 覆盖入口必须存在：人工修订后 `intake.warnings` 不会自动清除（清除它要改面板，见 note 的
 * Known items），没有覆盖入口，草稿就永远发不出去。`--force` / `--allow-warnings` 即覆盖，
 * 拒绝信息里会说明怎么覆盖。
 *
 * Deploy Hook 由 VERCEL_DEPLOY_HOOK 提供（.env，值到 Vercel 项目 → Settings → Git →
 * Deploy Hooks 创建）。变量缺失不阻断发布：内容已入表，只是站点不会自动重建，脚本明确警告。
 *
 * 用法：
 *   npm run content:publish -- --collection posts --path <path>
 *   npm run content:publish -- --path <path>                  # collection 缺省 posts
 *   npm run content:publish -- --collection posts --path <path> --dry-run
 *   npm run content:publish -- --path <path> --force           # 覆盖 intake 失败门禁
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 */

import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";
import { getEntry } from "../src/lib/content-store.ts";
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

/*-- intake 失败门禁的显式覆盖。两个名字等价，都是"我知道它带失败记录、仍要发布"的声明：
     面板修订后 intake.warnings 不会自动清除，没有这个入口草稿会被永久锁死 --*/
const allowWarnings = argv.includes("--force") || argv.includes("--allow-warnings");

function parseFrontmatter(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * 这条记录是否被 intake 失败记录挡住：返回归结原因列表，没挡则返 null。
 * 判据与 `content-intake --list` 打的"⚠️ 失败"、面板草稿箱的标记是同一条
 * （frontmatter.intake.status），不另立一套。
 */
function intakeBlockers(frontmatter) {
  const intake = frontmatter.intake;
  const info = intake && typeof intake === "object" ? intake : null;
  if (!info || info.status !== "failed") return null;
  const reasons = Array.isArray(info.warnings)
    ? info.warnings.filter((reason) => typeof reason === "string")
    : [];
  return reasons.length > 0 ? reasons : ["原因未记录（frontmatter.intake.warnings 为空）"];
}

async function main() {
  const path = flagValue("--path").trim();
  if (!path) {
    throw new Error("缺少 --path <集合内路径>（草稿的 path，见 npm run content:intake -- --list）");
  }
  const collection = flagValue("--collection").trim() || "posts";
  log.start(`发布草稿 ${collection}/${path}${dryRun ? "（dry-run）" : ""}`);

  /*-- 门禁只挡"真的发布"，不挡 --dry-run：dry-run 的目的正是看这条草稿能不能发，预检把
        查看动作也挡掉就没法判断该改什么。记录不存在时不在此处报错，交给 publishIntakeDraft
        那份统一的"草稿不存在"，免得两处消息漂移。 --*/
  if (!dryRun) {
    const current = await getEntry(collection, path);
    const blockers = current ? intakeBlockers(parseFrontmatter(current.frontmatter)) : null;
    if (blockers && !allowWarnings) {
      /*-- 就地报错并置退出码：这里要的是"逐条原因 + 怎么覆盖"的多行输出，一句 error 装不下 --*/
      log.error(`拒绝发布：${collection}/${path} 带 intake 失败记录`);
      blockers.forEach((reason) => log.error(`  - ${reason}`));
      log.info("确认内容已人工修订后，加 --force（或 --allow-warnings）重试即可发布");
      process.exitCode = 1;
      return;
    }
  }

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
    log.fail("字段校验失败，未发布（该记录状态未被改动）:");
    err.issues.forEach((issue) => log.error(`  - ${issue}`));
    log.info("修订这些字段后重试（dev 面板或手工改 frontmatter）");
    return;
  }
  log.fail(`执行失败: ${err.message}`);
});
