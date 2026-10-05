---
schema: harness-note/1
id: a23b0b97-0aac-4dfc-a881-c6c6c6b1942c
kind: decision
lifecycle: proposed
created: 2026-10-05
class: architecture
---

# 决策：内容移出仓库，构建期从 LanceDB 拉取写盘

## Context

公开仓 `TreeX-X/blogX_x` 同时是代码仓与内容仓，`src/content/**` 下 55 条内容占 71KB 仓库中的 56KB，其中三篇 posts 的正文是与 LanceDB 不一致的失真副本。Astro 的 `glob` loader 只要求构建时磁盘上存在 `.md` 文件，不关心其来源，这使"内容不入库、构建期拉取"成为可能。

## Decision

`src/content/**` 移出 git 并加入 `.gitignore`。`scripts/content-pull.mjs` 在 `prebuild` 与 `predev` 时从 `content` 表全量拉取，按原嵌套路径写盘并生成 frontmatter，`status: draft` 记录不写盘。`glob` loader、`src/lib/content.ts` 与全部页面零改动。`scripts/fetch-articles.mjs` 停止回写 `.md`。

## Alternatives considered

内容留在 git、仅修真源归属：失真副本留在仓里，漂移继续，且公开仓仍含正文。

页面改 SSR 直读 LanceDB：发布零延迟，但丢失 prerender 与 SEO，且 LanceDB 原生模块在 Vercel serverless 有既有兼容风险（`article-db.ts` 已用动态导入规避）。

每集合一张 LanceDB 表：多一层表名与 schema 维护，单表加 `collection` 字段已足够。

## Consequences

空机器首次构建必须能访问 LanceDB；`content-pull` 成为构建前置步骤，缺失时构建出空站点而非失败。仓库体积降为纯代码。`sync-obsidian-kb.mjs` 的写入目标从 git 工作区变为 LanceDB，Obsidian 降为可选输入源。

## Revisit signals

出现秒级发布需求；出现离线构建需求；`content-pull` 频繁因 LanceDB 不可达而使部署失败。
