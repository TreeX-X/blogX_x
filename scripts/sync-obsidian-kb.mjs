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
const PROJECT_ROOT = process.cwd();

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

function normalizeObsidianBody(input) {
  const normalizedLines = input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
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

function assertSafeTargetDir() {
  const normalizedRoot = path.resolve(PROJECT_ROOT);
  const normalizedTarget = path.resolve(TARGET_PATH);
  const contentRoot = path.resolve(PROJECT_ROOT, "src/content");

  if (!normalizedTarget.startsWith(normalizedRoot + path.sep)) {
    throw new Error(`LOCAL_KB_CONTENT_DIR must stay inside project root: ${normalizedTarget}`);
  }
  if (!normalizedTarget.startsWith(contentRoot + path.sep)) {
    throw new Error(`LOCAL_KB_CONTENT_DIR must stay inside src/content: ${normalizedTarget}`);
  }
}

function clearTargetMarkdown(dir) {
  if (!fs.existsSync(dir)) return;
  const names = fs.readdirSync(dir);
  for (const name of names) {
    const absolutePath = path.join(dir, name);
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      clearTargetMarkdown(absolutePath);
      if (fs.readdirSync(absolutePath).length === 0) fs.rmdirSync(absolutePath);
      continue;
    }
    if (absolutePath.toLowerCase().endsWith(".md") || absolutePath.toLowerCase().endsWith(".mdx")) {
      fs.unlinkSync(absolutePath);
    }
  }
}

function normalizeMarkdown(rawContent, sourceFilePath, sourceRoot) {
  const parsed = matter(rawContent);
  const stat = fs.statSync(sourceFilePath);
  const relativePath = path.relative(sourceRoot, sourceFilePath);
  const fileName = path.basename(sourceFilePath);
  const cleanedBody = normalizeObsidianBody(parsed.content);
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

  return `${matter.stringify(cleanedBody.trim(), normalizedData).trimEnd()}\n`;
}

function syncKnowledgeBase() {
  const sourceAbs = path.resolve(SOURCE_PATH);
  if (!fs.existsSync(sourceAbs) || !fs.statSync(sourceAbs).isDirectory()) {
    throw new Error(`Obsidian path is invalid: ${sourceAbs}`);
  }
  assertSafeTargetDir();

  const markdownFiles = getAllMarkdownFiles(sourceAbs);
  ensureDir(TARGET_PATH);
  clearTargetMarkdown(TARGET_PATH);

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
  console.log(`[sync-kb] synced ${syncedCount} files -> ${TARGET_RELATIVE_PATH}`);
  console.log(`[sync-kb] source: ${sourceAbs}`);
  console.log("[sync-kb] to change source path, set OBSIDIAN_KB_PATH");

  if (SHOULD_STAGE) {
    stageKnowledgeBaseChanges();
    console.log("[sync-kb] staged knowledge-base changes");
  }
}

try {
  main();
} catch (error) {
  console.error(`[sync-kb] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
