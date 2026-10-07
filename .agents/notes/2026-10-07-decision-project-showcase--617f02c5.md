---
schema: harness-note/1
id: 617f02c5-4375-42bc-8527-3548064f7a34
kind: decision
lifecycle: implemented
created: 2026-10-07
class: feature
---

# 项目展示使用真实预览和精选 README 快照

## Context

关于页的项目列表需要让读者看懂项目的用途和实际形态。只有仓库名称、描述和相同的流程标签时，桌面工具与工作流框架缺少可辨识的差别。项目 README 已包含功能介绍和真实素材；完整文档的安装命令、徽章和长篇说明不适合直接放进展示卡片。

## Decision

`src/pages/about.astro` 使用横向项目卡片：静态预览、简介、最多三项能力、标签和仓库入口。手机布局依次排列预览和文字。原生 details 在卡片内展开最多四节纯文本介绍，并提供完整 README 链接。边框浅灰，辅助文字保持小号灰色，内容层次依靠留白。

`src/lib/project-readme.ts` 从 GitHub API 读取最新提交和同一提交下的 README，将相对素材路径解析到该版本。提取器跳过代码块、徽章及部分安装章节，保留有限长度的简介、能力、章节和图片候选。前台输出转义后的纯文本。网络请求仅接受 HTTPS GitHub 仓库地址，超时和上游错误返回明确失败。

项目的 `readmeSnapshot` 与手动 `summary`、`highlights`、`coverImage`、`coverAlt`、`demoUrl` 分开存储。展示优先使用非空手动字段，其次使用快照，缺少快照时仍显示已有描述。`/admin/projects` 的“从 README 更新”只预览数据，用户点击保存后才写入 LanceDB `content` 表；读取失败保留当前内容，更换仓库且未提交新快照时清除旧快照。项目编辑保留正文、翻译字段和发布状态。

访客读取已保存快照，不发起 GitHub 内容请求。JanusX 与 WorkFlowX 的封面和演示来自上游真实素材，来源版本与许可见 [素材说明](../../public/projects/ATTRIBUTION.md)。两张 WebP 静态预览合计约 84KB，GIF 仅在点击播放后加载，停止时恢复静态预览。图片失败显示文字占位并保留仓库入口。本地素材需要人工更新；读取 README 不会下载或转换新的封面。

CLI `node scripts/sync-project-readmes.mjs --all --dry-run` 预览全部项目，`--slug <slug>` 选择单项；去掉 `--dry-run` 保存快照并保留其他字段。内容拉取和发布沿用现有链路，生成的 `src/content/projects` 文件不是真相源。

## Alternatives considered

复用仅含文字和外链的卡片最省维护，适合没有截图或稳定文档的仓库。两个现有项目都有真实素材，展示预览和精选介绍更能帮助读者判断用途。

直接渲染完整 README 可以保留所有格式、目录和代码，适合独立项目详情页。关于页需要控制长度，纯文本精选章节可以减少格式适配与内容清洗的维护成本。

访客实时请求 GitHub 可以自动跟进文档，却让页面依赖上游限流和网络，也会绕过作者对简介的调整。保存快照把更新留在内容管理阶段，代价是需要主动刷新。

## Consequences

展示内容可以独立编辑，GitHub 暂时不可用时仍有已有快照。提取采用规则，不理解所有 Markdown 变体，章节和能力可能需要手动调整；能力可在后台覆盖，完整文档通过外链阅读。GIF 最大约 3.3MB，按需加载限制默认流量，但播放仍消耗对应带宽。

## Verification

`node scripts/test-project-readme.mjs` 的五项测试通过，覆盖素材和章节提取、相对路径、空文档、请求地址限制、提交版本固定、429 失败，以及字段边界和链接校验。

开发服务器运行时执行 `node scripts/test-project-showcase.mjs`，真实两张预览、延迟 GIF、键盘展开、390px 手机排列、图片失败占位和访客零 GitHub 内容请求均通过。后台测试使用模拟接口，覆盖读取不保存、手动字段保留、失败保留、仓库变更拦截、显式保存和文本转义。Playwright 外部安装通过 `PLAYWRIGHT_MODULE` 和 `PLAYWRIGHT_EXECUTABLE` 指定，截图输出到系统临时目录。

真实开发接口的临时草稿验证项目 PUT 保留正文、翻译、草稿状态、手动字段和快照，更换仓库清除快照；临时记录删除后项目数量恢复为两条。两个真实项目的快照和本地素材字段位于内容云，初始化保留原有正文及发布状态。`node scripts/content-pull.mjs` 拉取 59 条已发布内容，其中项目两条；CLI 全项目 dry-run 和真实 README 预览接口均成功。

`npx astro build` 通过。直接调用生产函数产物的 fetch，关于页返回两张含封面及快照简介的卡片，`/admin/projects` 和 POST `/api/admin/project-readme` 返回 404。`npx astro check` 仍有十项既有错误，位于留言状态类型、首页可选日期和导航粒子空上下文，本功能文件没有诊断。开发期间更改共享 schema 后，既有 Astro 内容缓存可能保留裁剪后的旧字段，需要清理开发 `.astro/data-store.json` 后重启；生产内容缓存可通过 `npx astro sync --force` 重建。

## Revisit signals

项目数量或单项介绍长度明显增加时，增加独立详情页。README 格式频繁变化、规则提取不能满足编辑需求时，再引入可编辑章节或专用 Markdown 解析器。需要封面随 README 自动更新时，再加入素材下载、静态帧生成和来源版本管理。
