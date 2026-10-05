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

新增 `scripts/content-pull.mjs`：从 `content` 表拉取 `status: published` 的全部记录，**先清空再写入** `src/content/{posts,knowledge-base,wiki,repos,skills,projects}` 各目录后，按原嵌套路径写盘并生成 frontmatter。清空重建是硬要求：`src/content/**` 现在是构建产物，残留文件会被 glob loader 收进来并可能使构建失败（实例见 T1 的 Known items——一篇被本地钩子同步进来的私人笔记引用不存在的图片，令整个构建报 `ImageNotFound`）。`status: draft` 记录不写盘。

`package.json` 中 `prebuild` 改为 `content-pull` 后接 `pack-skills`，新增 `predev` 执行 `content-pull`，并新增 `content:backup`、`content:restore`、`content:migrate`、`content:pull` 脚本入口。

`.gitignore` 增加 `src/content/`，执行 `git rm -r --cached src/content` 使公开仓不再追踪任何内容文件。执行 `git rm --cached` 前先确认内容已在 `content` 表与 git 历史中各有一份完整副本。调整 `.github/workflows/vector-sync.yml`：原触发条件依赖 `src/content/**` 变更，内容出仓后该条件永不成立，索引重建改由构建期 `init-db` 承担，工作流仅保留手动触发。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-2，以及 AC-8 中关于构建与 LanceDB 降级的部分。

## Verification

`git ls-files src/content` 为空；改动后 `git status` 不出现 `src/content` 变更；删除整个 `src/content` 目录后 `npm run build` 能重新生成完整站点且内容与 T1 迁移的 59 条一致；在 `src/content` 中预先放置一个无关文件（模拟残留）后重跑 `content-pull`，该文件被清除、构建不因它失败；本地 `src/content` 已存在时 `npm run dev` 正常启动。

## Dependencies

T1（[note://f6f78001-d086-47ba-b627-787ada391296/a7c1fab4-4118-443f-8de0-60c44714b875](2026-10-05-task-t1-content-store--a7c1fab4.md)）已落地且 `content` 表含全量 59 条内容。

## Allowed scope

`scripts/content-pull.mjs`、`package.json`、`.gitignore`、`.github/workflows/vector-sync.yml`
