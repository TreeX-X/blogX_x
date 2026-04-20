import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function runGit(args) {
  return spawnSync("git", args, { cwd: process.cwd(), encoding: "utf-8" });
}

function resolveGitStatus() {
  const result = runGit(["rev-parse", "--is-inside-work-tree"]);
  if (result.error) {
    return {
      ok: false,
      reason: "spawn_error",
      detail: `${result.error.name}: ${result.error.message}`,
    };
  }
  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  if (result.status === 0 && stdout === "true") return { ok: true, reason: "" };
  if (/dubious ownership/i.test(stderr)) return { ok: false, reason: "dubious_ownership", detail: stderr };
  if (/not a git repository/i.test(stderr)) return { ok: false, reason: "not_repo", detail: stderr };
  return { ok: false, reason: "unknown", detail: stderr || stdout };
}

function ensureExecutable(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {
    // Windows may ignore chmod; keep best-effort.
  }
}

function main() {
  const status = resolveGitStatus();
  if (!status.ok) {
    if (status.reason === "not_repo") {
      console.log("[prepare] not a git repository, skip hook setup.");
      return;
    }
    if (status.reason === "dubious_ownership") {
      console.warn("[prepare] git refused repository ownership check.");
      console.warn("[prepare] run: git config --global --add safe.directory \"E:/Tree Workspace/blogX_x\"");
      console.warn("[prepare] skip hook setup for now.");
      return;
    }
    if (status.reason === "spawn_error") {
      console.warn(`[prepare] failed to execute git: ${status.detail}`);
      console.warn("[prepare] ensure git is installed and available in PATH.");
      return;
    }
    console.warn(`[prepare] unable to verify git repo: ${status.detail || "unknown error"}`);
    return;
  }

  const hooksDir = path.join(process.cwd(), ".githooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  ensureExecutable(path.join(hooksDir, "pre-commit"));
  ensureExecutable(path.join(hooksDir, "pre-push"));

  const result = runGit(["config", "core.hooksPath", ".githooks"]);
  if (result.status !== 0) {
    throw new Error(result.stderr || "failed to set core.hooksPath");
  }
  console.log("[prepare] configured core.hooksPath=.githooks");
}

try {
  main();
} catch (error) {
  console.error(`[prepare] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
