#!/usr/bin/env node
/**
 * 外链文章刷新：content 表 posts 记录 → 抓取 + 翻译 → 回写同一条记录
 *
 * 内容真相源是 LanceDB `content` 表（单表），本脚本只做一件事：把 posts 集合里带
 * http(s) sourceUrl 的记录按原 path 原地刷新——重新抓取原文、重新翻译，写回
 * originalBody / translatedBody / body 与 frontmatter 的 fetched / intake 子对象，
 * path 与 status 一律不变（绝不把在架文章降级成草稿，也不新建 -2 副本）。
 *
 * 与旧版的区别（T5，内容出仓之后）：
 * - 不再扫描 src/content/posts：那已是 prebuild/predev 由 content-pull 生成的产物，
 *   而且草稿根本不写盘，扫描磁盘等于漏掉一半记录。枚举源改为 content 表本身，
 *   "哪篇文章要刷新"不再依赖本机磁盘上恰好有什么。
 * - 不再 upsert `articles` 表：站点侧零读取方，双语正文只有 posts 记录这一份 master。
 * - 不再回写任何 .md：正文的唯一载体是 content 表，写 .md 就是再造第二份 master。
 * - 抓取与富媒体翻译不再有本脚本自己的一份副本：整条"URL → 双语正文 + 结构化 frontmatter"
 *   流水线只有 src/lib/article-intake.service.ts 一份实现（content-intake CLI 与 dev 面板
 *   共用）。本脚本以 write:false 调用它拿产物，再自己决定写回哪条记录、保留哪些字段。
 *
 * 默认只补缺：originalBody 为空、或 translatedBody 为空/与原文同语言的记录才会被刷新。
 * 对已完整的语料，`npm run build` 里的这一步是空转——不会每次部署都打一遍外部 LLM，也不会让
 * 构建写云端内容。但只要有一条记录缺译文（面板新建后直接发布、或外部 LLM 曾失败），这一步就
 * 会重试它。全部重来用 --force。
 *
 * 失败不静默（与 T4 同一原则）：
 * - 抓取失败：原记录一个字节都不动。旧版会写一条 originalContent 为空的失败记录，
 *   把好数据直接冲掉，那是比失败本身更坏的行为。抓取失败一律退出码 1。
 * - 写回失败：原文已取到但没落库（最常见是 content-store 在降级连接上拒绝写入），
 *   磁盘状态没变。它不是"抓取失败"，构建期只报告；--force 下 exit 1。
 * - 翻译失败：保留原有译文，把 intake 记下的失败原因逐条念出来，汇总里再列出受影响的
 *   slug。退出码分情形：显式运行（--force）、译文从合格退化为不合格（回归）、抓取失败
 *   都是 exit 1；构建期只是给"本来就缺"的记录补缺而失败时只报告、不阻断构建——构建期
 *   对 intake 期的配额失败负责，是门禁放错了层（详见 note 的 Known items）。
 *
 * 用法：
 *   node scripts/fetch-articles.mjs              # 只刷新缺原文 / 缺译文的 posts 记录
 *   node scripts/fetch-articles.mjs --force      # 全部重新抓取 + 翻译
 *   node scripts/fetch-articles.mjs --dry-run    # 只报告会刷新哪些记录、会写成什么样，不写库
 *   （--translate 仍被接受但无额外含意：翻译本来就是流水线的一部分。--force-translate 已移除，
 *     见下方参数解析处的说明。）
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 * Note: 内容移出仓库、构建期从 LanceDB 拉取写盘 — see .agents/notes/2026-10-05-decision-content-out-of-repo--a23b0b97.md
 * Note: 抓取/翻译/发布链唯一实现在 intake 通道 — see .agents/notes/2026-10-05-task-t4-ai-intake--d5d2cc71.md
 */

import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";
import { listCollection, upsertEntry } from "../src/lib/content-store.ts";
import { createIntakeDraft } from "../src/lib/article-intake.service.ts";
import { detectLanguage } from "../src/lib/article-translation.service.mjs";

/*-- 服务在调用时才读 process.env，故 dotenv.config() 必须在任何查询之前 --*/
dotenv.config();

const log = new Logger("fetch-articles");

/*===== 命令行参数 =====*/
const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

/*-- --force-translate 已移除且不能默默忽略：它的语义是"只重译不重抓"，而抓取与翻译现在是
     intake 流水线里的同一个动作，没有"拿到原文却不翻译"的中间态。静默忽略会让调用方以为
     重译过了，实际什么都没做。判据在 main() 里抛给统一失败出口，不用 process.exit
     （见 Logger.fail 的说明）。 --*/
const forceTranslate = args.includes("--force-translate");

/*===== 统计计数器 =====*/
const stats = {
  total: 0,
  refreshed: 0,
  skipped: 0,
  fetchFailed: 0,
  translateFailed: 0,
  /*-- 写回失败：原文取到了，content 表没写下（最常见是 content-store 在降级连接上拒绝写入）。
       与"抓取失败"分开记——它既不是说错事实，也不该把构建期补缺拖成 exit 1 --*/
  writeFailed: 0,
  /*-- 回归：刷新前译文合格、本次刷新后不合格。与"本来就缺"必须分开计数 --*/
  regressed: 0,
  /*-- 跑完后仍缺可用译文的记录 slug：让"译文陈旧"成为可枚举、可查询的状态 --*/
  stalePaths: [],
};

/*===== 工具函数 =====*/

function parseFrontmatter(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/**
 * 双语正文是否可用：译文非空，且语言与原文相反。
 *
 * intake 的契约是"翻译失败也返回一份译文"：translateText 段落级失败回退原文、整体异常回退
 * 原文、缺 key 时返回占位译文，三者都指向同一个信号——译文落回了原文的语言。所以"译文非空"
 * 完全不等于"翻译成功"，必须过语言这一关。判据与 content-migrate 从 articles 表多代记录里
 * 挑真实译文时用的同一条：译文语言必须与原文相反。把未翻译的原文当译文留在记录里，正是
 * T1 迁移时要避开的那类失真，只不过方向反了过来。
 *
 * 检测不出语言（纯图/代码页）时不擅动：非空即认为可用，避免每条记录每次运行都被重刷。
 */
function hasUsableTranslation(originalBody, translatedBody) {
  if (!translatedBody.trim()) return false;
  const originalLang = detectLanguage(originalBody, null);
  const translatedLang = detectLanguage(translatedBody, null);
  if (originalLang === "unknown" || translatedLang === "unknown") return true;
  return originalLang !== translatedLang;
}

/**
 * 记录是否已具备完整双语正文：原文非空，且译文可用。
 *
 * 这一个谓词同时是"只补缺"的筛选判据和"回归"的对比基准：它决定哪些记录被跳过，也决定
 * 哪些记录失败才算"被改坏"。拆成两个判据必然漂移——这正是"本来就缺"与"被改坏"被混为
 * 一谈、导致构建对 intake 期的失败负责的根源。
 */
function hasCompleteBilingual(record) {
  return Boolean(record.originalBody.trim()) && hasUsableTranslation(record.originalBody, record.translatedBody);
}

/*===== 单条记录刷新 =====*/

/**
 * 把 intake 产物合并回一条已存在的 posts 记录。
 *
 * 保留：path、status、以及 frontmatter 顶层由人手维护的字段（title / date / tags /
 * description / originalAuthor …）。刷新：originalBody、译文、originalLang，以及
 * fetched（抓取期元数据，article-db 优先读它）与 intake（成败自述，失败必须随记录可见）。
 *
 * wasComplete 是刷新前的译文状态（调用方用 hasCompleteBilingual 取）：true = 刷新前合格。
 * 返回本次是否采用了新译文。统计由调用方统一记账——落库失败时磁盘状态没变，判据得按
 * "刷新前状态"算而不是"本次刷新结果"算，记账放在这一处会把它错记成回归。
 */
async function refreshRecord(record, draft, wasComplete) {
  const existingFrontmatter = parseFrontmatter(record.frontmatter);
  const fresh = draft.record;
  const warnings = Array.isArray(draft.warnings) ? draft.warnings : [];
  /*-- 两个信号都说不失败才采用新译文：语言方向对不上，或 intake 自己记了"正文翻译失败" --*/
  const languageLooksUntranslated = !hasUsableTranslation(fresh.originalBody, fresh.translatedBody);
  const intakeReportedFailure = warnings.some((warning) => String(warning).includes("正文翻译失败"));
  const translated = !languageLooksUntranslated && !intakeReportedFailure;

  if (!translated) {
    /*-- 回归必须单独点出来：它意味着一次刷新把好译文弄坏了，与"这条本来就缺译文"不是一回事 --*/
    log.warn(
      `${record.path} — 未采用本次译文，保留原有译文（${record.translatedBody.length} 字符）` +
        (wasComplete ? "（注意：刷新前译文是合格的，本次把它改坏了——回归）" : "")
    );
    if (languageLooksUntranslated) {
      log.warn(
        `  译本语言与原文相同（${detectLanguage(fresh.originalBody, null)}），疑似未真正翻译`
      );
    }
    for (const warning of warnings) {
      log.warn(`  intake: ${warning}`);
    }
  }

  const translatedBody = translated ? fresh.translatedBody : record.translatedBody;
  /*-- body 与译文保持一致：content-pull 把 body 写盘做降级渲染，二者漂移就又多一份master --*/
  const body = translated ? fresh.translatedBody : record.body;

  const frontmatter = {
    ...existingFrontmatter,
    originalLang: draft.frontmatter?.originalLang ?? existingFrontmatter.originalLang,
    fetched: draft.frontmatter?.fetched,
    intake: draft.frontmatter?.intake,
  };

  if (dryRun) {
    log.file(`dry-run：将写回 posts/${record.path}（status 保持 ${record.status}）`);
    log.file(
      `  originalBody ${record.originalBody.length} → ${fresh.originalBody.length}，` +
        `translatedBody ${record.translatedBody.length} → ${translatedBody.length}`
    );
    stats.refreshed += 1;
    return translated;
  }

  await upsertEntry({
    collection: "posts",
    path: record.path,
    frontmatter: JSON.stringify(frontmatter),
    body,
    originalBody: fresh.originalBody,
    translatedBody,
    status: record.status,
    updatedAt: new Date().toISOString(),
  });
  stats.refreshed += 1;
  log.save(
    `${record.path} — 已写回 content 表（originalBody ${fresh.originalBody.length} / ` +
      `translatedBody ${translatedBody.length} / body ${body.length}）`
  );
  return translated;
}

/*===== 主流程 =====*/

async function main() {
  if (forceTranslate) {
    throw new Error(
      "--force-translate 已移除：抓取与翻译共用 intake 的同一条流水线，无法只重译不重抓。要重来用 --force。"
    );
  }
  log.start("外链文章刷新（content 表 posts → 抓取 + 翻译 → 回写同一记录）");
  log.config(
    `模式: ${force ? "强制全部刷新" : "只补缺（缺原文 / 缺译文）"}${dryRun ? "（dry-run，不写库）" : ""}`
  );

  /*-- 1. 枚举源是 content 表本身，不是 src/content/posts --*/
  const posts = await listCollection("posts");
  stats.total = posts.length;
  if (posts.length === 0) {
    log.warn("content 表没有 posts 记录，无事可做");
    return;
  }
  log.info(`content 表 posts 集合共 ${posts.length} 条记录`);

  /*-- 2. 选出要刷新的记录 --*/
  const candidates = [];
  for (const record of posts) {
    const frontmatter = parseFrontmatter(record.frontmatter);
    if (!isHttpUrl(frontmatter.sourceUrl)) {
      log.skip(
        `${record.path} — sourceUrl 不是外链（${String(frontmatter.sourceUrl || "").slice(0, 48) || "空"}），跳过`
      );
      stats.skipped += 1;
      continue;
    }
    /*-- 译文与原文同语言即视为缺译文：上次翻译失败时会留下这样一份"假译文" --*/
    if (!force && hasCompleteBilingual(record)) {
      log.skip(`${record.path} — 已有完整双语正文，跳过（--force 可强制刷新）`);
      stats.skipped += 1;
      continue;
    }
    candidates.push({
      record,
      sourceUrl: String(frontmatter.sourceUrl).trim(),
      /*-- 刷新前的译文状态：true = 刷新前合格（只有 --force 才可能为 true）。用于区分
           "本来就缺"与"被改坏" --*/
      wasComplete: hasCompleteBilingual(record),
    });
  }

  if (candidates.length === 0) {
    log.info("没有需要刷新的记录");
    return;
  }
  log.info(`待刷新 ${candidates.length} 条记录`);

  /*-- 3. 逐条走 intake 流水线（write:false，写回由本脚本决定）--*/
  for (let idx = 0; idx < candidates.length; idx++) {
    const { record, sourceUrl, wasComplete } = candidates[idx];
    log.process(`[${idx + 1}/${candidates.length}] ${record.path} — ${sourceUrl}`);
    let draft;
    try {
      draft = await createIntakeDraft(
        { source: "url", url: sourceUrl },
        { write: false, onProgress: (message) => log.process(`  ${message}`) }
      );
    } catch (error) {
      stats.fetchFailed += 1;
      log.error(`${record.path} — 抓取失败，原记录未改动: ${error.message}`);
      continue;
    }

    let adopted = false;
    let writeBroke = false;
    try {
      adopted = await refreshRecord(record, draft, wasComplete);
    } catch (error) {
      /*-- 原文已经取到，失败发生在落库（最常见是 content-store 在降级连接上拒绝写入）。
           这不叫"抓取失败"：记成抓取失败是说错事实，还会把构建期补缺拖成 exit 1。--*/
      writeBroke = true;
      stats.writeFailed += 1;
      log.error(`${record.path} — 写回失败，译文未更新: ${error.message}`);
    }

    /*-- 记账统一在这里，判据是磁盘状态而不是"本次刷新成没成功"：落库失败时磁盘一个字节都
           没变，本来就缺的仍然缺、刷新前合格的没被改坏（绝不能记成回归） --*/
    if (writeBroke) {
      if (!wasComplete) stats.stalePaths.push(record.path);
    } else if (!adopted) {
      stats.translateFailed += 1;
      stats.stalePaths.push(record.path);
      if (wasComplete) stats.regressed += 1;
    }
  }

  /*-- 4. 报告 --*/
  log.summary({
    "记录总数": stats.total,
    "已刷新": stats.refreshed,
    "跳过": stats.skipped,
    "抓取失败": stats.fetchFailed,
    "写回失败": stats.writeFailed,
    "翻译失败（保留原译文）": stats.translateFailed,
    "其中回归（刷新前合格）": stats.regressed,
    "译文仍缺/陈旧的记录": stats.stalePaths.join(", ") || "无",
  });
  if (stats.translateFailed > 0) {
    log.warn("有记录翻译失败：原有译文原样保留，站点渲染不受影响，但译文不是最新的");
  }
  if (stats.writeFailed > 0) {
    log.warn("有记录写回失败：原文已取到但没落库，磁盘上的译文一点没变，站点渲染不受影响");
  }
  if (stats.stalePaths.length > 0) {
    /*-- 让"译文陈旧"成为可枚举、可查询的状态：slug 清单进汇总，判据与查询路径写清楚，
           不必去翻上面每一条 warn 才能拼出受影响集合 --*/
    log.warn(
      `译文仍缺/陈旧的记录（${stats.stalePaths.length}）: ${stats.stalePaths.join(", ")}` +
        "（content 表判据：originalBody 非空而 translatedBody 为空或与其同语言；失败原因在记录的 frontmatter.intake）"
    );
  }

  /*-- 5. 退出码：分情形。构建期只给"本来就缺"的记录补缺，它不该为 intake 期的配额失败
        负责——那是门禁放错了层（真正该设门禁的是发布期，见 content-publish 的 intake 门禁）。
        判据是刷新前的状态 wasComplete，同一谓词筛选用过一次，两处不会漂移。写回失败同理：
        磁盘没变、站点照常渲染，构建期只报告；--force 是显式要求刷新，没刷成要 exit 1。--*/
  const failures = [];
  if (stats.fetchFailed > 0) failures.push(`${stats.fetchFailed} 条抓取失败`);
  if (stats.regressed > 0) {
    failures.push(`${stats.regressed} 条译文从合格退化为不合格（回归）`);
  }
  if (force && stats.translateFailed > 0) {
    failures.push(`--force 显式刷新，${stats.translateFailed} 条翻译失败`);
  }
  if (force && stats.writeFailed > 0) {
    failures.push(`--force 显式刷新，${stats.writeFailed} 条写回失败`);
  }
  if (failures.length > 0) {
    throw new Error(`${failures.join("、")}（详见上方日志）`);
  }
}

main().catch((err) => {
  log.fail(`脚本执行失败: ${err.message}`);
});
