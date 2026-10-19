---
{
  "schema": "harness-note/2",
  "id": "11f13778-66af-413b-9a36-49cdd3097f34",
  "kind": "decision",
  "lifecycle": "accepted",
  "created": "2026-10-19",
  "updated": "2026-10-19T08:04:30Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# 文章阅读左栏：自动章节树与阅读进度

## Context

用户指定 claude.dev/blog 阅读页（solving-code-review-at-anthropic）的设计作为目标：左侧自动解析章节跳转，树下有阅读进度条，要求 blog 阅读页具备同类功能。此前文章页只有右侧 `toc-panel`，其条目来自构建期 Markdown headings，LanceDB 正文（ArticleReader）路径完全无目录，语言切换后也没有任何章节定位能力。

## Decision

`posts/[slug].astro` 阅读布局改为「左栏 + 正文」，左栏为 `src/components/ReadingRail.tsx`（client:load），两条渲染路径（ArticleReader / Markdown 降级）共用：

- 挂载后从目标容器自动解析 `h2–h4` 生成树；无 id 标题按 unicode 字母数字 slug 补齐并去重，已有 id 保留。正文替换（原文/译文切换）由 MutationObserver 重建树。
- 当前章节取最后一个越过视口 40% 线的标题；组头（h2）激活或子项（h3/h4）激活时展开该组折叠子树，离组收起。点击平滑滚动（reduced-motion 直切）并写入 hash；初始带 hash 自动定位。
- 树下为 28 格 `▓░` 字符进度条 + 百分比（含 `role="progressbar"` 与 aria 值），进度口径为正文底边对齐视口底；其下显示阅读时长。滚过 h1 后栏顶浮现文章标题。
- 视觉按暖纸体系收尾（等宽 `└` 树、牛血激活与进度填充、宋体浮现标题），不照搬 claude.dev 的终端字符主题；顶栏既有细进度线保留。≤1024px 隐藏左栏，正文单列。

## Alternatives considered

沿用右侧 `toc-panel` 并补进度条：条目依赖构建期 headings，无法覆盖 ArticleReader 路径，也不随语言切换；解析逻辑放在阅读栏一处可同时服务两条路径。整页照搬 claude.dev 的等宽 ASCII 观感与暖纸排版冲突，仅保留其树形、`└` 与 `▓░` 进度作为识别特征。

## Consequences

目录由 SSR 变为水合后解析：无 JS 时只有内容没有树（进度条静态 00%）。知识库 / Wiki 阅读页仍用右侧 `toc-panel`，未迁移到左栏。原文与译文标题不同，切换语言后锚点 id 随语言重建，旧 hash 不再命中。树项很多时子树折叠只露出 h2，长文可用但无过滤或钉住能力。

## Verification

自写 CDP 脚本（`_temp/cdp-check*.mjs`，Playwright Chromium 156 + dev :4399）实测：15 个标题解析出 15 个树项且 id 补齐（含中文 slug）；滚动中进度 45%/39% 与激活高亮、`aria-current` 正确；点击写 hash 并定位到目标章节；组头激活 → 子树展开、子项激活 → 保持展开并高亮、离组 → 收起（31%/32%/94% 三次定位）；EN/中 切换后树重建为对应语言；420px 视口左栏隐藏。截图 `_temp/shot-top.png`、`shot-mid.png`、`shot-mobile.png` 人工目视通过。`npx astro check` 10 errors 与既有基线一致（均在 nav-particles.ts），本轮源文件零新增诊断。

未测项：Markdown 降级路径（本机 3 篇均有 LanceDB 正文，未走降级分支；组件与 targetSelector 结构相同）；无 JS 浏览器。

## Revisit signals

需要无 JS 可读目录、或知识库 / Wiki 统一左栏时，再做构建期树提取与 toc-panel 迁移；单篇文章树项超过约 40 个或读者反馈找不到章节时，考虑树内过滤或当前章节自动滚入可视区。
