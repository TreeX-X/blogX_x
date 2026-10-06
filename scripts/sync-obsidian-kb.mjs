#!/usr/bin/env node
/**
 * Obsidian vault → LanceDB `content` 表（knowledgeBase 集合）按条目导入
 *
 * 内容真相源是 LanceDB `content` 表，src/content/** 已是构建期由 content-pull 生成的产物
 * （.gitignore）。所以本脚本的写入目标从"仓库里的一个目录"改为"content 表"，Obsidian 降级为
 * 可选输入源：vault 在不在本机，与构建、管理、部署全都无关。
 *
 * 导入必须按条目选择，禁止整库自动同步。
 * vault 里有从未发布的私人笔记（`思路记载/未命名.md`，已由 .git/info/exclude 本地排除，
 * 且其图片链接在本机不存在）。整库导入等于把这类笔记直接推上公网站点，这类事故已经发生过
 * 一次（T1 的 Known items：一篇被钩子同步进来的私人笔记引用不存在的图片，令 astro build
 * 抛 ImageNotFound，整个构建失败）。所以：
 *   - 不给 --only 时本脚本什么都不做，只列出候选项；
 *   - 排除清单里的条目即使被 --only 点名也拒绝导入；
 *   - `--only all` / `--only '*'` / `--only .` 一律拒绝。
 *
 * 用法：
 *   node scripts/sync-obsidian-kb.mjs --list                          # 列出 vault 候选项与可否导入
 *   node scripts/sync-obsidian-kb.mjs --to-lancedb --only "AI使用技巧/AI评选.md"
 *   node scripts/sync-obsidian-kb.mjs --to-lancedb --only a.md --only b.md --dry-run
 *   （--only 的值是相对 vault 的路径，带不带 .md 都认）
 *
 * 幂等性：按 (knowledgeBase, path) 先删后插（LanceDB 无原地更新），重复执行不产生重复记录。
 * status 对已存在的记录原样保留；新记录默认 published——选择条目的是人，这一步就是发布动作，
 * 与内容出仓前"同步即上线"的行为一致。撤回发布见 scripts/content-publish.mjs。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 * Note: 内容移出仓库、构建期从 LanceDB 拉取写盘 — see .agents/notes/2026-10-05-decision-content-out-of-repo--a23b0b97.md
 * Note: 私人笔记禁迁 + vault 导入必须按条目选择 — see .agents/notes/2026-10-05-task-t1-content-store--a7c1fab4.md
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import dotenv from "dotenv";
import { Logger } from "./lib/logger.mjs";
import { getEntry, upsertEntry } from "../src/lib/content-store.ts";

/*-- content-store 在调用时才读 process.env，故 dotenv.config() 必须在任何查询之前 --*/
dotenv.config();

const log = new Logger("sync-kb");

/*===== 配置 =====*/
const DEFAULT_OBSIDIAN_KB_PATH = "E:\\Tree Workspace\\obsidian\\树的知识库";
const SOURCE_PATH = process.env.OBSIDIAN_KB_PATH || DEFAULT_OBSIDIAN_KB_PATH;
const IGNORED_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);
const COLLECTION = "knowledgeBase";

/*-- 私人笔记排除清单：判据为相对 vault 的路径（正斜杠）。与 content-migrate 的清单同源，
     判据口径不同是因为那份清单按相对 src/content 的路径登记。今后任何"从 vault 导入"都
     必须按条目在这里登记并注明理由，禁止整库自动同步。 --*/
const PRIVATE_EXCLUDED = new Set(["思路记载/未命名.md"]);

/*-- 明令禁止的"导入全部"写法：给了就是误会，必须报错而不是照做 --*/
const FORBIDDEN_SELECTORS = new Set(["all", ".", "*", "**", "-"]);

/*===== 命令行参数 =====*/
const args = process.argv.slice(2);
const toLancedb = args.includes("--to-lancedb");
const listOnly = args.includes("--list");
const dryRun = args.includes("--dry-run");
const showHelp = args.includes("--help") || args.includes("-h");

let onlyPaths = [];

function collectOnly() {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--only") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--only 需要一个相对 vault 的路径参数");
      }
      values.push(value);
      i += 1;
    } else if (args[i].startsWith("--only=")) {
      values.push(args[i].slice("--only=".length));
    }
  }
  return values;
}

/*-- 参数解析失败与 --stage 都用 log + exit 1：在模块顶层 throw 只会甩一段 Node 栈，
     本脚本其余失败路径都给的是一句人能读的话，这两处不该例外 --*/
try {
  onlyPaths = collectOnly();
  if (args.includes("--stage")) {
    throw new Error(
      "--stage 已移除：src/content/** 随内容出仓变成构建产物（.gitignore），git add 恒被拒，该路径单独运行即以 exit 1 失败。写入目标现在是 content 表。"
    );
  }
} catch (error) {
  log.error(`同步失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

/*===== 工具函数 =====*/

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

/** 统一选择器的书写形式：正斜杠、去首尾空白、可省 .md 后缀 */
function normalizeSelector(value) {
  const trimmed = String(value || "").trim().replace(/\\/g, "/");
  if (!trimmed) return "";
  return trimmed.replace(/\.mdx?$/i, "");
}

function assertSafeSelector(value) {
  const normalized = normalizeSelector(value);
  if (!normalized) {
    throw new Error("--only 给了空值");
  }
  if (FORBIDDEN_SELECTORS.has(normalized) || FORBIDDEN_SELECTORS.has(normalized.toLowerCase())) {
    throw new Error(
      `拒绝整库导入：--only ${value}。vault 含未发布的私人笔记，导入必须逐条点名（先 --list 看候选项）。`
    );
  }
  if (normalized.split("/").includes("..")) {
    throw new Error(`--only 必须是相对 vault 的路径，不接受 ..：${value}`);
  }
  return normalized;
}

function computeHash(text) {
  return crypto.createHash("md5").update(text, "utf8").digest("hex");
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[>#*_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeObsidianBody(input) {
  const normalizedLines = input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/ /g, " ")
    .replace(/​/g, "")
    .split("\n")
    .map((line) => line.replace(/\t/g, "  ").replace(/[ \t]+$/g, ""));

  const output = [];
  let inFence = false;

  const ensureBlankBefore = () => {
    if (output.length === 0) return;
    if (output[output.length - 1] !== "") output.push("");
  };

  for (let i = 0; i < normalizedLines.length; i++) {
    let line = normalizedLines[i];

    if (!inFence) {
      // Drop Obsidian comments block markers.
      if (line.trim() === "%%") continue;
      // Convert Obsidian callout to standard blockquote.
      line = line.replace(/^>\s*\[![^\]]+\]\s*/, "> ");
      // Normalize accidental single-space list indentation from notes.
      line = line.replace(/^ {1,3}([-*+])\s+/, "$1 ");
      line = line.replace(/^ {1,3}(\d+\.)\s+/, "$1 ");
      // Convert wikilink/image syntax to standard markdown as best effort.
      line = line.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alt) => {
        const text = String(alt || target || "").trim();
        const linkTarget = String(target || "").trim().replace(/ /g, "%20");
        return `![${text}](${linkTarget})`;
      });
      line = line.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, label) => {
        const text = String(label || target || "").trim();
        const linkTarget = String(target || "").trim().replace(/ /g, "%20");
        return `[${text}](${linkTarget})`;
      });
    }

    const fenceMatched = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (fenceMatched) {
      const [, indent, , rest] = fenceMatched;
      line = `${indent}\`\`\`${rest}`;
      if (!inFence) ensureBlankBefore();
      inFence = !inFence;
      output.push(line);
      if (!inFence) output.push("");
      continue;
    }

    if (!inFence) {
      const trimmed = line.trim();
      const isHeading = /^#{1,6}\s+/.test(trimmed);
      const isRule = /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed);
      if (isHeading || isRule) ensureBlankBefore();
      output.push(line);
      if (isHeading || isRule) output.push("");
      continue;
    }

    output.push(line);
  }

  const compacted = [];
  for (const line of output) {
    if (line === "" && compacted[compacted.length - 1] === "") continue;
    compacted.push(line);
  }
  return `${compacted.join("\n").trim()}\n`;
}

function toTitleFromName(fileName) {
  return fileName
    .replace(/\.mdx?$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAllMarkdownFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const names = fs.readdirSync(dir).sort((a, b) => a.localeCompare(b, "zh-CN"));
  for (const name of names) {
    if (IGNORED_DIRS.has(name)) continue;
    const absolutePath = path.join(dir, name);
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      getAllMarkdownFiles(absolutePath, files);
      continue;
    }
    if (absolutePath.toLowerCase().endsWith(".md") || absolutePath.toLowerCase().endsWith(".mdx")) {
      files.push(absolutePath);
    }
  }
  return files;
}

/*===== 记录构造 =====*/

/** vault 相对路径（正斜杠，不含扩展名）= content 表的 path */
function toRecordPath(relativePath) {
  return relativePath.replace(/\.mdx?$/i, "");
}

/**
 * 从一份 vault markdown 构造 content 表记录。
 * status / updatedAt 先给默认值（新记录 published + now），importSelected 会按"记录是否已存在"
 * 覆盖 status——已存在记录的状态绝不因为一次导入而改变。
 */
function buildRecord(sourceRoot, sourceFile) {
  const relativePath = toPosixPath(path.relative(sourceRoot, sourceFile));
  const fileName = path.basename(sourceFile);
  const raw = fs.readFileSync(sourceFile, "utf-8");
  const parsed = matter(raw);
  const stat = fs.statSync(sourceFile);
  const cleanedBody = normalizeObsidianBody(parsed.content);

  const title =
    typeof parsed.data.title === "string" && parsed.data.title.trim()
      ? parsed.data.title.trim()
      : toTitleFromName(fileName);

  const date =
    typeof parsed.data.date === "string" && parsed.data.date.trim()
      ? parsed.data.date.trim()
      : stat.mtime.toISOString().slice(0, 10);

  const description =
    typeof parsed.data.description === "string" && parsed.data.description.trim()
      ? parsed.data.description.trim()
      : stripMarkdown(cleanedBody).slice(0, 96);

  const frontmatter = {
    ...parsed.data,
    title,
    date,
    description,
    /*-- 与内容出仓前同一约定：来源随条目可见，见 src/pages/api/admin/_helpers.ts 的保留键清单 --*/
    source: `obsidian:${relativePath}`,
  };

  return {
    relativePath,
    record: {
      collection: COLLECTION,
      path: toRecordPath(relativePath),
      frontmatter: JSON.stringify(frontmatter),
      body: cleanedBody.trim(),
      /*-- 双语正文只有 posts 用；其余两列留空 --*/
      originalBody: "",
      translatedBody: "",
      status: "published",
      updatedAt: new Date().toISOString(),
    },
  };
}

/*===== 子命令 =====*/

function printHelp() {
  console.log(`
Obsidian vault → content 表（${COLLECTION} 集合）按条目导入

  --list                      列出 vault 候选项（相对路径 + 标题 + 是否可导入）
  --to-lancedb --only <路径>  只导入点名的条目（可重复 --only）
  --to-lancedb --only <路径> --dry-run   只报告将写入什么，不写库
  --to-lancedb --only <路径> --force     即使内容哈希未变也重写

选择器的值是相对 vault 的路径，带不带 .md 都认，例如：
  node scripts/sync-obsidian-kb.mjs --to-lancedb --only "AI使用技巧/AI评选.md"

不给 --only 时什么都不导入：vault 里有未发布的私人笔记，整库自动同步已禁用。
`);
}

function listCandidates(sourceRoot) {
  const files = getAllMarkdownFiles(sourceRoot);
  if (files.length === 0) {
    log.warn(`vault 下没有 markdown 文件: ${sourceRoot}`);
    return [];
  }
  log.start(`vault 候选项（${files.length} 个）— ${sourceRoot}`);
  const rows = files.map((file) => {
    const relativePath = toPosixPath(path.relative(sourceRoot, file));
    const excluded = PRIVATE_EXCLUDED.has(relativePath);
    let title = path.basename(file);
    try {
      const parsed = matter(fs.readFileSync(file, "utf-8"));
      title =
        typeof parsed.data.title === "string" && parsed.data.title.trim()
          ? parsed.data.title.trim()
          : toTitleFromName(path.basename(file));
    } catch {
      /*-- 读不动/解析不了也照样列出来，标题退回文件名 --*/
    }
    return [relativePath, title, excluded ? "🚫 排除（私人笔记）" : "可导入"];
  });
  log.table(["相对路径", "标题", "状态"], rows);
  log.info(`导入：node scripts/sync-obsidian-kb.mjs --to-lancedb --only "<相对路径>"`);
  return rows.filter((row) => !row[2].startsWith("🚫")).map((row) => row[0]);
}

async function importSelected(sourceRoot, selected) {
  const byRelative = new Map();
  for (const file of getAllMarkdownFiles(sourceRoot)) {
    byRelative.set(toPosixPath(path.relative(sourceRoot, file)), file);
  }

  const imported = [];
  const unchanged = [];
  let rejected = 0;

  for (const selector of selected) {
    const normalized = normalizeSelector(selector);
    const matched = [...byRelative.keys()].find(
      (relativePath) => relativePath === normalized || toRecordPath(relativePath) === normalized
    );
    if (!matched) {
      throw new Error(`vault 中找不到 --only 指定的条目: ${selector}（先 --list 看相对路径）`);
    }
    if (PRIVATE_EXCLUDED.has(matched)) {
      /*-- 即使被点名也拒绝：排除清单的意义就在于不受临时选择影响 --*/
      rejected += 1;
      log.error(`${matched} — 在私人笔记排除清单中，拒绝导入`);
      continue;
    }

    const { relativePath, record } = buildRecord(sourceRoot, byRelative.get(matched));
    const existing = await getEntry(COLLECTION, record.path);
    const nextHash = computeHash(`${record.frontmatter}\n${record.body}`);

    if (existing) {
      const currentHash = computeHash(`${existing.frontmatter}\n${existing.body}`);
      /*-- 状态是人工发布动作的结果，导入绝不改它：覆盖会把在架条目撤下站点 --*/
      record.status = existing.status;
      if (currentHash === nextHash && !args.includes("--force")) {
        log.skip(`${record.path} — 内容未变，跳过（--force 可强制重写）`);
        unchanged.push(record.path);
        continue;
      }
    }

    if (dryRun) {
      log.file(`dry-run：将写回 ${COLLECTION}/${record.path}（status ${record.status}）`);
      log.file(`  body ${existing ? existing.body.length : 0} → ${record.body.length} 字符`);
      imported.push(record.path);
      continue;
    }

    await upsertEntry(record);
    imported.push(record.path);
    log.save(`${record.path} — 已写入 content 表（${COLLECTION}，status ${record.status}）`);
  }

  log.summary({
    "选中": selected.length,
    "已写入": imported.length,
    "未变": unchanged.length,
    "拒绝（私人笔记）": rejected,
  });

  if (!dryRun && imported.length > 0) {
    /*-- 内容出仓后 content 表变更不触发 Vercel 重建（git push 才触发），这一步必须说出来 --*/
    log.info("content 表已变更，但站点不会自动重建：git push 一次或手动部署，草稿态记录还需 content:publish");
  }
  if (rejected > 0) {
    /*-- 点名要导入却被排除清单挡下，是调用方的意图落空，不能当成功收场 --*/
    throw new Error(`${rejected} 个条目被私人笔记排除清单拒绝，未导入`);
  }
  return { imported, unchanged, rejected };
}

/*===== 主流程 =====*/

async function main() {
  if (showHelp) {
    printHelp();
    return;
  }

  const sourceAbs = path.resolve(SOURCE_PATH);
  if (!fs.existsSync(sourceAbs) || !fs.statSync(sourceAbs).isDirectory()) {
    throw new Error(`Obsidian path is invalid: ${sourceAbs}（可用 OBSIDIAN_KB_PATH 覆盖）`);
  }

  if (listOnly) {
    listCandidates(sourceAbs);
    return;
  }

  if (!toLancedb) {
    throw new Error(
      "本脚本只写 content 表（--to-lancedb）。写 src/content/** 的模式已移除：那已是构建期由 content-pull 生成的产物，写进去会被下一次 content-pull 冲掉。"
    );
  }

  if (onlyPaths.length === 0) {
    throw new Error(
      "必须用 --only 逐条指定要导入的条目（可重复）。整库导入已禁用：vault 含未发布的私人笔记。先 --list 看候选项。"
    );
  }

  const selected = onlyPaths.map(assertSafeSelector);
  log.start(`Obsidian → content 表（${COLLECTION}）${dryRun ? "（dry-run，不写库）" : ""}`);
  log.config(`源路径: ${sourceAbs}`);
  log.config(`选中 ${selected.length} 条: ${selected.join(", ")}`);

  await importSelected(sourceAbs, selected);
}

main().catch((err) => {
  log.error(`同步失败: ${err.message}`);
  process.exit(1);
});
