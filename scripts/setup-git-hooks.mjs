import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function runGit(args) {
  return spawnSync("git", args, { cwd: process.cwd(), encoding: "utf-8" });
}

function isGitRepo() {
  const result = runGit(["rev-parse", "--is-inside-work-tree"]);
  return result.status === 0 && String(result.stdout).trim() === "true";
}

function main() {
  if (!isGitRepo()) {
    console.log("[prepare] 非 git 仓库，跳过 hooks 配置。");
    return;
  }

  const hooksDir = path.join(process.cwd(), ".githooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const result = runGit(["config", "core.hooksPath", ".githooks"]);
  if (result.status !== 0) {
    throw new Error(result.stderr || "failed to set core.hooksPath");
  }
  console.log("[prepare] 已设置 core.hooksPath=.githooks");
}

main();
