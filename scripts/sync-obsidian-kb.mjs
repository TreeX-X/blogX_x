import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_OBSIDIAN_KB_PATH = "E:\\Tree Workspace\\obsidian\\树的知识库";
const SOURCE_PATH = process.env.OBSIDIAN_KB_PATH || DEFAULT_OBSIDIAN_KB_PATH;
const TARGET_RELATIVE_PATH = process.env.LOCAL_KB_CONTENT_DIR || "src/content/knowledge-base";
const TARGET_PATH = path.resolve(process.cwd(), TARGET_RELATIVE_PATH);
const SHOULD_STAGE = process.argv.includes("--stage");
const IGNORED_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

function toTitleFromName(fileName) {
  return fileName
    .replace(/\.mdx?$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAllMarkdownFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (IGNORED_DIRS.has(name)) continue;
    const absolutePath = path.join(dir, name);
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      getAllMarkdownFiles(absolutePath, files);
      continue;
    }
    if (absolutePath.toLowerCase().endsWith(".md")) files.push(absolutePath);
  }
  return files;
}

function normalizeMarkdown(rawContent, sourceFilePath, sourceRoot) {
  const parsed = matter(rawContent);
  const stat = fs.statSync(sourceFilePath);
  const relativePath = path.relative(sourceRoot, sourceFilePath);
  const fileName = path.basename(sourceFilePath);
  const cleanedBody = parsed.content.trim();
  const title = typeof parsed.data.title === "string" && parsed.data.title.trim()
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

  const normalizedData = {
    ...parsed.data,
    title,
    date,
    description,
    source: `obsidian:${relativePath.replace(/\\/g, "/")}`,
  };

  return `${matter.stringify(cleanedBody, normalizedData).trimEnd()}\n`;
}

function syncKnowledgeBase() {
  const sourceAbs = path.resolve(SOURCE_PATH);
  if (!fs.existsSync(sourceAbs) || !fs.statSync(sourceAbs).isDirectory()) {
    throw new Error(`Obsidian path is invalid: ${sourceAbs}`);
  }

  const markdownFiles = getAllMarkdownFiles(sourceAbs);
  fs.rmSync(TARGET_PATH, { recursive: true, force: true });
  ensureDir(TARGET_PATH);

  let syncedCount = 0;
  for (const sourceFile of markdownFiles) {
    const relative = path.relative(sourceAbs, sourceFile);
    const targetFile = path.join(TARGET_PATH, relative);
    ensureDir(path.dirname(targetFile));

    const raw = fs.readFileSync(sourceFile, "utf-8");
    const normalized = normalizeMarkdown(raw, sourceFile, sourceAbs);
    fs.writeFileSync(targetFile, normalized, "utf-8");
    syncedCount += 1;
  }

  return { syncedCount, sourceAbs };
}

function stageKnowledgeBaseChanges() {
  const result = spawnSync("git", ["add", "--", TARGET_RELATIVE_PATH], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("git add failed for knowledge-base content");
  }
}

function main() {
  const { syncedCount, sourceAbs } = syncKnowledgeBase();
  console.log(`✅ 已同步 ${syncedCount} 篇文档到 ${TARGET_RELATIVE_PATH}`);
  console.log(`📚 来源目录: ${sourceAbs}`);
  console.log("💡 修改知识库目录时，请更新环境变量 OBSIDIAN_KB_PATH");

  if (SHOULD_STAGE) {
    stageKnowledgeBaseChanges();
    console.log("✅ 已自动执行 git add（knowledge-base 内容）");
  }
}

main();
