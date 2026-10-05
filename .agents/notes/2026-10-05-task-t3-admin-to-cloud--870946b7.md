---
schema: harness-note/1
id: 870946b7-1881-47c6-89ba-6083237cd47a
kind: task
lifecycle: proposed
created: 2026-10-05
class: architecture
execution: pending
---

# T3 管理入口上云

## Scope

`src/pages/api/admin/{posts,repos,projects,skills,toolbox}.ts` 的写方法改调 `content-store`，删除 `writeFile`、`unlink`、`cp` 与本地目录操作；面板保持"点保存即生效"的既有体验，GET 改为读 `content` 表而非本地文件。

新增 knowledgeBase 与 wiki 的管理页与接口，保留 Obsidian 的嵌套路径，支持新增、编辑、移动与重命名——这两个集合今天只能靠本地 vault 同步生成，是"任意机器可管理"最后的缺口。

toolbox 改为经 `content-pull` 生成 `src/content/toolbox/*.md` 并新增 `toolbox` 集合，`src/lib/toolbox.ts` 的数组改为集合读取，`/toolbox` 页与 AI 搜索的 toolbox scope 同步改造。skills 的 zip 继续由 `pack-skills` 生成，提交只涉及元数据记录。

**跨任务集成项（来自 T0 评审）**：`src/pages/api/ideas/admin.ts` 导出 GET/POST，位于 `/api/ideas/*` 而非 `/api/admin/*`，因此不在 T0 中间件的阻止前缀内，生产环境公网可达，实测返回 401（有 admin session 鉴权，不是未授权写入洞）。需求 Goal 要求公开写入面为零，故本任务必须对它做出处置并记录理由：纳入中间件阻止前缀、改为受控入口，或书面豁免。不允许静置不管。

## Acceptance

满足 [内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md) 的 AC-5。

## Verification

`npm run dev` 下七类集合的增改删都落在 `content` 表并即时反映在页面上；KB 与 wiki 的嵌套路径可增删与重命名；`/toolbox` 列表与 AI 搜索 toolbox scope 的行为与改前一致；生产环境下同一批接口仍返回 404，不回退；`/api/ideas/admin` 的处置已落地且在 note 中写明理由。

## Dependencies

T2（[note://f6f78001-d086-47ba-b627-787ada391296/3680cc06-8960-4265-acb5-861ea4d931ae](2026-10-05-task-t2-build-chain--3680cc06.md)）已落地，`content-pull` 可用。

## Allowed scope

`src/pages/api/admin/*.ts`、`src/pages/api/ideas/admin.ts`、`src/pages/admin/knowledge-base.astro`、`src/pages/admin/wiki.astro`、`src/pages/toolbox/index.astro`、`src/lib/toolbox.ts`、`src/content.config.ts`、`src/lib/content.ts`、`src/pages/api/ai-search.ts`
