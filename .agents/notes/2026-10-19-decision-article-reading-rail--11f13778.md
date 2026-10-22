---
{
  "schema": "harness-note/2",
  "id": "11f13778-66af-413b-9a36-49cdd3097f34",
  "kind": "decision",
  "lifecycle": "accepted",
  "created": "2026-10-19",
  "updated": "2026-10-22T02:19:48Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# 阅读左栏：自动章节树与阅读进度

## Context

用户指定 claude.dev/blog 阅读页（solving-code-review-at-anthropic）的设计作为目标：左侧自动解析章节跳转，树下有阅读进度条，要求 blog 阅读页具备同类功能。此前文章页只有右侧 `toc-panel`，其条目来自构建期 Markdown headings，LanceDB 正文（ArticleReader）路径完全无目录，语言切换后也没有任何章节定位能力。左栏落地后用户提出知识库导航与文章统一，同时点出自动折叠在查阅型内容上可能是问题——目录是知识库的全局地图，折叠会把「看结构」变成「跳过去才能看结构」。本次按此把知识库 / Wiki 迁入左栏并参数化折叠行为。

## Decision

全站阅读页（文章 `posts/[slug].astro`、知识库 `knowledge-base/[...slug].astro`、Wiki `wiki/[...slug].astro`）共用「左栏 + 正文」布局，左栏为 `src/components/ReadingRail.tsx`（client:load）；文章两条渲染路径（ArticleReader / Markdown 降级）与知识库 / Wiki 的静态正文同一套解析：

- 挂载后从目标容器自动解析 `h2–h4` 生成树；无 id 标题按 unicode 字母数字 slug 补齐并去重，已有 id 保留。正文替换（原文/译文切换）由 MutationObserver 重建树。
- 当前章节取最后一个越过视口 40% 线的标题。点击平滑滚动（reduced-motion 直切）并写入 hash；初始带 hash 自动定位。
- 折叠按 `variant` 参数化：`article`（默认）维持阅读聚焦——组头（h2）激活或子项（h3/h4）激活时展开该组折叠子树，离组收起；`reference` 供知识库 / Wiki 查阅跳转——子树常开，滚动只做高亮不收放。折叠状态与滚动绑定在查阅场景会收起用户正在看的子树，且隐藏未展开组的下级结构，故参考型内容不做自动折叠。
- 树下为 28 格 `▓░` 字符进度条 + 百分比（含 `role="progressbar"` 与 aria 值），进度口径为正文底边对齐视口底；其下显示阅读时长（知识库 / Wiki 暂无字数来源，不显示）。滚过 h1 后栏顶浮现文章标题。
- 视觉按暖纸体系收尾（等宽 `└` 树、牛血激活与进度填充、宋体浮现标题），不照搬 claude.dev 的终端字符主题；顶栏既有细进度线保留。≤1024px 隐藏左栏，正文单列。
- 知识库 / Wiki 原右侧 `toc-panel` 连同其全局 scrollspy 脚本与样式一并移除，站点不再保留第二套目录体系。

## Alternatives considered

沿用右侧 `toc-panel` 并补进度条：条目依赖构建期 headings，无法覆盖 ArticleReader 路径，也不随语言切换；解析逻辑放在阅读栏一处可同时服务所有阅读页。整页照搬 claude.dev 的等宽 ASCII 观感与暖纸排版冲突，仅保留其树形、`└` 与 `▓░` 进度作为识别特征。知识库 / Wiki 只统一视觉、保留右侧 `toc-panel`：两套目录的定位、高亮与溢出行为会持续分叉，且知识库作为查阅型内容反而拿弱导航。`reference` 变体做「默认全开 + 组头手动折叠」：常开已解决查阅痛点，手动折叠属推测性交互，未做。

## Consequences

目录由 SSR 变为水合后解析：无 JS 时只有内容没有树（进度条静态 00%）——此约束现覆盖知识库 / Wiki，原 `toc-panel` 是 SSR 目录，迁移后无 JS 兜底一并消失。原文与译文标题不同，切换语言后锚点 id 随语言重建，旧 hash 不再命中。树项很多时 `article` 变体子树折叠只露出 h2，长文可用但无过滤或钉住能力；`reference` 变体目录全见但在超长条目里树会更长。≤1024px 隐藏左栏意味着移动端知识库 / Wiki 也无目录（原 `toc-panel` 在窄屏会落到正文末尾）。知识库 / Wiki 无字数来源，左栏不显示阅读时长。

## Verification

首版（2026-10-19，文章）：CDP 脚本实测 15 标题解析、滚动进度与高亮、点击写 hash、组开合、EN/中 切换重建、420px 隐藏，截图目视通过。本轮（2026-10-22，知识库 / Wiki 迁移）：CDP 脚本（`_temp/verify-kb-rail.mjs`，headless Edge 155 + dev :4399）26/26 通过——知识库「个人博客2.0」24 树项 / 4 组子树在顶部与滚动中均 4/4 常开、滚动高亮与进度 49%、点击写 hash、标题浮现；Wiki `log` 14 树项同套交互通过（条目为平铺 h2，无子树可验）；文章回归确认 `article` 变体仍只展开当前组（1/1）。1440px 截图 `_temp/shot-kb-top.png`、`shot-kb-mid.png` 目视通过（左树右文、`└` 树、牛血高亮与进度）。`npx astro check` 10 errors 与既有基线一致（均在 nav-particles.ts），零新增诊断。

未测项：Markdown 降级路径；无 JS 浏览器；≤1024px 仅确认左栏隐藏的 DOM 状态，未逐页目视；知识库含 h3 嵌套的 Wiki 条目（现存 Wiki 源均为平铺 h2）。

## Revisit signals

需要无 JS 可读目录时再做构建期树提取；移动端需要目录时做抽屉或顶部折叠，覆盖三类阅读页；单篇文章树项超过约 40 个或读者反馈找不到章节时，考虑树内过滤、当前章节自动滚入可视区，或 `reference` 变体的组头手动折叠。
