---
schema: harness-note/1
id: 3680cc06-8960-4265-acb5-861ea4d931ae
kind: task
lifecycle: proposed
created: 2026-10-05
class: architecture
execution: pending
---

# T2 构建期拉取与内容出仓

## Scope

新增 `scripts/content-pull.mjs`：从 `content` 表全量拉取，按原嵌套路径写入 `src/content/**` 并生成 frontmatter，`status: draft` 记录不写盘。`package.json` 中 `prebuild` 改为 `content-pull` 后接 `pack-skills`，新增 `predev` 执行 `content-pull`，并新增 `content:backup`、`content:restore`、`content:migrate`、`content:pull` 脚本入口。

`.gitignore` 增加 `src/content/`，执行 `git rm -r --cached src/content` 使公开仓不再追踪任何内容文件。调整 `.github/workflows/vector-sync.yml`：原触发条件依赖 `src/content/**` 变更，内容出仓后该条件永不成立，索引重建改由构建期 `init-db` 承担，工作流仅保留手动触发。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-2，以及 AC-8 中关于构建与 LanceDB 降级的部分。

## Verification

`git ls-files src/content` 为空；改动后 `git status` 不出现 `src/content` 变更；删除本地 `src/content` 目录后 `npm run build` 能重新生成完整站点；本地 `src/content` 已存在时 `npm run dev` 正常启动。

## Dependencies

T1（[note://f6f78001-d086-47ba-b627-787ada391296/a7c1fab4-4118-443f-8de0-60c44714b875](2026-10-05-task-t1-content-store--a7c1fab4.md)）已落地且 `content` 表含全量内容。

## Allowed scope

`scripts/content-pull.mjs`、`package.json`、`.gitignore`、`.github/workflows/vector-sync.yml`
