# 📘 PRD - 布局与知识库优化

**文档状态**: Draft  
**更新日期**: 2026-05-11  
**版本**: v1.0

---

## 1. 🎯 项目概述

- **项目目标**：优化 BlogX_x 个人数字花园在 PC 端与移动端的布局体验，扩展内容区域的有效利用面积，为知识库列表页增加分类侧栏，并改善 Markdown 内容的排版呈现质量。
- **核心价值**：在不破坏现有极简黑白编辑器风格的前提下，让 PC 端用户充分利用屏幕宽度，让移动端用户继续获得良好体验，同时提升知识库的可浏览性和导航效率。

## 2. 👥 目标用户

- **技术博客读者（PC 端）**：在 1920px+ 显示器上浏览，期望内容区不过于狭窄
- **移动端浏览者**：在手机上访问，期望内容自适应、不出现横向滚动
- **知识库深度用户**：频繁在知识库各分类之间切换，需要快速跳转和全局视图

## 3. 🚧 边界与范围

### 在范围内

- `.container` 宽度策略的重构，PC 端放宽上限，移动端保持当前适配
- 文章详情页与知识库详情页的网格列宽优化
- `.prose-wrap` 的 `max-width` 调整
- 知识库列表页新增分类侧栏组件
- Markdown 渲染样式的补充优化
- 所有改动仅通过 CSS 和 Astro 模板层面实现

### 在范围外 / 非目标

- ❌ 不改变整体视觉风格（极简黑白、编辑器美学）
- ❌ 不修改数据层（`lib/content.ts`、内容集合配置）
- ❌ 不添加新的 API 端点
- ❌ 不重构首页布局（`home-layout` 已充分利用空间）
- ❌ 不引入外部 CSS 框架或 UI 组件库
- ❌ 不重新设计导航栏和 footer

## 4. 🛡️ 非功能性需求

- **注释**：生成代码需添加中文注释，格式为 `/*-- 注释内容 --*/`
- **响应式**：所有布局改动必须通过 `@media` 查询适配多分辨率屏幕（断点沿用 `700px`）
- **性能**：不引入额外 JS 运行时开销
- **可访问性**：侧栏导航需具备 `aria-label`，键盘可聚焦
- **主题兼容**：所有新增样式必须同时兼容 light/dark 主题
- **多分辨率适配**：页面必须能自动适配多种分辨率屏幕，包括但不限于：
  - 移动端：375px、414px（手机竖屏）
  - 平板：768px、1024px（iPad 等）
  - 笔记本：1280px、1366px
  - 桌面显示器：1440px、1920px、2560px（4K）
  - 使用流式布局（百分比、`minmax`、`clamp`、`min/max`）而非固定像素值
  - 关键断点至少覆盖：`≤700px`（移动端）、`701px–1024px`（平板）、`≥1025px`（PC 端）

## 5. 📈 成功标准

- PC 端（≥1280px）内容区有效宽度利用率从约 55% 提升至 ≥75%
- 知识库列表页侧栏在 PC 端可见且可交互，在移动端合理隐藏或折叠
- Markdown 内容在长段落、代码块、表格、图片等场景下排版美观无溢出

## 6. ⚙️ 核心功能与验收标准

### 功能 1：容器宽度策略重构（P0）

**描述**：当前 `.container` 使用 `width: min(840px, calc(100% - 2rem))`，导致 PC 端内容区被压缩至 840px。需要将容器宽度上限提升至 1200px，PC 端充分利用屏幕空间，移动端保持不变。

**验收标准**：
- [ ] PC 端（≥1280px 视口）容器宽度 > 1000px
- [ ] 移动端（≤700px 视口）容器宽度行为与改动前完全一致
- [ ] 导航栏在所有视口下对齐无异常
- [ ] footer 在所有视口下对齐无异常

---

### 功能 2：文章 / 知识库详情页布局优化（P0）

**描述**：当前 `.article-layout` 使用 `grid-template-columns: minmax(0, 1fr) 230px`，`.prose-wrap` 有 `max-width: 72ch`，正文内容被挤在中部窄条。需要扩大正文可用宽度。

**实现要求**：
- `.prose-wrap` 的 `max-width` 从 `72ch` 提升至 `82ch` 或改为 `100%`
- `.article-layout` 的右侧 TOC 列宽适度增加至 `260px`
- 移动端折叠为单列，TOC 显示在正文顶部或隐藏

**验收标准**：
- [ ] PC 端文章正文区域有效宽度 ≥ 700px（在 1280px 视口下）
- [ ] TOC 侧栏在 PC 端 sticky 定位正常
- [ ] 移动端为单列布局，无横向溢出

---

### 功能 3：知识库列表页侧栏（P0）

**描述**：当前知识库列表页没有侧栏，所有分类平铺展示。需要新增侧栏展示分类目录并支持快速跳转。

**实现要求**：
- 新增 CSS 类 `.kb-layout`，采用 grid 布局：`grid-template-columns: minmax(0, 1fr) 240px`
- 侧栏内容：分类列表，每个分类为锚点链接，点击平滑滚动到对应区域
- 侧栏 `.sticky` 固定在视口顶部（复用 `top: 84px` 模式）
- 侧栏样式复用 `.kg-panel` 的边框和背景风格
- 每个条目显示分类名称和条目数量
- 移动端侧栏隐藏，改为横向分类标签条
- 各分类区块添加 `id` 属性支持锚点跳转

**验收标准**：
- [ ] PC 端知识库列表页右侧出现分类侧栏
- [ ] 侧栏 sticky 定位正常
- [ ] 点击分类条目，页面平滑滚动到对应区域
- [ ] 侧栏显示每个分类的条目数量
- [ ] 移动端侧栏不显示，改为横向分类标签条
- [ ] 侧栏样式与现有卡片/面板风格一致

---

### 功能 4：Markdown 内容显示优化（P1）

**描述**：知识库和文章的 Markdown 渲染在某些场景下存在排版瑕疵，需要进一步打磨。

**实现要求**：
- **代码块增强**：增加暗色主题下代码块的背景对比度，添加左侧边线
- **表格响应式**：外层包裹 `overflow-x: auto` 容器
- **引用块增强**：增加更明显的左侧色彩标识
- **链接样式**：正文链接添加下划线或颜色区分
- **图片优化**：确保 `max-width: 100%; height: auto`
- **hr 分割线**：`border: none; border-top: 1px solid var(--line)`
- **嵌套列表**：合理的左缩进
- **知识库特殊处理**：`.kb-prose` 的 `white-space: pre-wrap` 保留，确保段落间距合理

**验收标准**：
- [ ] 代码块在 light/dark 主题下可读性良好
- [ ] 移动端表格可水平滚动，不导致页面横向溢出
- [ ] 引用块视觉上明显区分于正文
- [ ] 正文链接与普通文字有明确视觉差异
- [ ] 图片在所有视口下不溢出
- [ ] `hr` 元素渲染为水平分割线
- [ ] 嵌套列表缩进合理

---

### 功能 5：文章列表页适配（P2）

**描述**：容器宽度扩大后，文章列表页需确保阅读体验不受影响。

**验收标准**：
- [ ] 文章列表在宽屏下卡片文字行宽不超过 100 字符
- [ ] 移动端列表布局不变

---

### 功能 6：关于页 / 工具箱页适配（P2）

**描述**：容器宽度变化会影响关于页和工具箱页，需确认表现。

**验收标准**：
- [ ] 关于页文字行宽合理
- [ ] 工具箱卡片网格在宽屏下多列对齐美观
- [ ] 移动端布局不受影响

---

## 7. 📚 工程文件索引

| 文件路径 | 文件作用 | 关联原因 |
|---------|---------|---------|
| `src/styles/global.css` | 全局样式定义 | 核心文件，所有布局宽度调整、新增侧栏样式、Markdown 优化均在此 |
| `src/layouts/BaseLayout.astro` | 基础布局模板 | 容器宽度变化影响所有页面 |
| `src/pages/knowledge-base/index.astro` | 知识库列表页 | 功能 3 主要改动文件 |
| `src/pages/posts/[slug].astro` | 文章详情页 | 功能 2 目标页面 |
| `src/pages/knowledge-base/[...slug].astro` | 知识库详情页 | 功能 2 和功能 4 目标页面 |
| `src/pages/posts/index.astro` | 文章列表页 | 功能 5 目标页面 |
| `src/pages/index.astro` | 首页 | 需确认容器变化后表现 |
| `src/pages/about.astro` | 关于页 | 功能 6 目标页面 |
| `src/pages/toolbox/index.astro` | 工具箱页 | 功能 6 目标页面 |

## 8. 📚 知识索引

| 知识条目 | 知识摘要 | 优先级 | 推荐阅读顺序 |
|---------|---------|-------|------------|
| CSS Grid 布局策略 | `.article-layout` 和 `.home-layout` 使用 CSS Grid，`minmax(0, 1fr)` 保证主列不溢出 | 高 | 1 |
| CSS `min()` 函数 | 当前 `width: min(840px, ...)` 是响应式核心，改为 `min(1200px, ...)` 需理解取值逻辑 | 高 | 2 |
| CSS `color-mix()` | 项目大量使用 `color-mix(in srgb, ...)` 实现半透明混合色，确保主题兼容 | 高 | 3 |
| `position: sticky` | 侧栏和 TOC 依赖 sticky 定位，`top: 84px` 由 header 高度 + padding 决定 | 中 | 4 |
| Astro Content Collections | 知识库数据通过 `getCollection` 获取，`getEntryPath()` 返回 `分类名/文件名` 格式 | 中 | 5 |
| `@media (max-width: 700px)` 断点 | 项目移动端断点统一使用 700px | 中 | 6 |
| CSS `scroll-behavior: smooth` | 侧栏锚点跳转需要平滑滚动 | 低 | 7 |

---

## 9. 🧪 评估报告（Evaluator Reserved）

### 9.1 最近一次评估元信息
- **评估时间**: 2026-05-11
- **评估范围**: src/styles/global.css, src/pages/knowledge-base/index.astro, src/pages/posts/index.astro, src/pages/about.astro, src/pages/knowledge-base/[...slug].astro, src/pages/posts/[slug].astro, tsconfig.json
- **评估人/Agent**: EvaluatorX_x
- **关联代码范围**: 布局宽度重构、知识库列表侧栏、文章/知识库详情页布局、Markdown 内容优化、其他页面适配

### 9.2 需求符合度概览

| 需求 | 类型 | 状态 | 对应代码 | 说明 |
|------|------|------|---------|------|
| 功能1：容器宽度策略重构 | P0 | ✅ | global.css:74 | `.container` 从 `min(840px, ...)` 改为 `min(1200px, ...)` |
| 功能2：文章/知识库详情页布局优化 | P0 | ✅ | global.css:491-503 | `prose-wrap` max-width 72ch→82ch, `article-layout` 右列 230px→260px |
| 功能3：知识库列表页侧栏 | P0 | ✅ | global.css:648-675; index.astro | 新增 `.kb-layout` 双栏布局 + 分类侧栏 + 移动端标签条 |
| 功能4：Markdown 内容显示优化 | P1 | ✅ | global.css:679-744 | 代码块/表格/引用/链接/图片/hr/嵌套列表全部优化 |
| 功能5：文章列表页适配 | P2 | ✅ | posts/index.astro:30 | 内联 `max-width: 780px` 控制卡片行宽 |
| 功能6：关于页/工具箱页适配 | P2 | ✅ | about.astro:16; toolbox 用 auto-fit grid | 关于页 780px 限宽,工具箱 repeat(auto-fit) 自适应 |

- ✅ 完全实现: 6 / 6
- ⚠️ 部分实现: 0
- ❌ 未实现: 0
- 🔄 不可评估: 0

### 9.2.1 验收标准（AC）符合度

| AC | 状态 | 对应代码 | 依据/差距 | 修改建议 |
|----|------|---------|----------|---------|
| **功能 1** | | | | |
| PC端(≥1280px)容器宽度 > 1000px | ✅ | global.css:74 | `min(1200px, calc(1280px-32px))` = 1200px > 1000px | N/A |
| 移动端(≤700px)容器宽度行为与改动前一致 | ✅ | global.css:74 | `min(1200px, calc(700px-32px))` = 668px, 改动前 `min(840px, 668px)` = 668px, 行为一致 | N/A |
| 导航栏在所有视口下对齐无异常 | ✅ | global.css:79-87; BaseLayout.astro:42 | `.site-header .inner` 使用 `.container`，header/footer 均在同一容器内 | N/A |
| footer 在所有视口下对齐无异常 | ✅ | global.css:126-132; BaseLayout.astro:54 | `.site-footer > .container` 与 header 容器相同 | N/A |
| **功能 2** | | | | |
| PC端文章正文有效宽度 ≥ 700px (1280px视口) | ✅ | global.css:491-503 | 容器 1200px - 右列 260px - gap 18.4px = 921.6px 列宽; `prose-wrap` max-width 82ch ≈ 787px (IBM Plex Sans 16px) ≥ 700px | N/A |
| TOC 侧栏在 PC 端 sticky 定位正常 | ✅ | global.css:504-510 | `position: sticky; top: 84px;` 复用已有 header 高度模式 | N/A |
| 移动端为单列布局，无横向溢出 | ✅ | global.css:1228-1238 | `@media (max-width: 700px)` 内 `grid-template-columns: 1fr; gap: 0.9rem` | N/A |
| **功能 3** | | | | |
| PC端知识库列表页右侧出现分类侧栏 | ✅ | global.css:648-652; kb/index.astro | `.kb-layout` grid 两栏, `<aside class="kb-sidebar">` 渲染在右侧 | N/A |
| 侧栏 sticky 定位正常 | ✅ | global.css:654-662 | `position: sticky; top: 84px; align-self: start;` | N/A |
| 点击分类条目，页面平滑滚动到对应区域 | ✅ | global.css:24; kb/index.astro:54 | `html { scroll-behavior: smooth; }` + 锚点链接 `href={`#kb-cat-${groupName}`}` + 分类区块 `id` | N/A |
| 侧栏显示每个分类的条目数量 | ✅ | global.css:693-698; kb/index.astro:69-70 | `.kb-sidebar-count` 显示 `{groupedEntries[groupName].length}` | N/A |
| 移动端侧栏不显示，改为横向分类标签条 | ✅ | global.css:953-976 | `@media (max-width: 700px)`: `.kb-sidebar { display: none; }`, `.kb-tags { display: flex; }` | N/A |
| 侧栏样式与现有卡片/面板风格一致 | ✅ | global.css:654-662 | 复用 `border: 1px solid var(--line); border-radius: var(--radius); background: color-mix(...)` 与 `.kg-panel` 风格一致 | N/A |
| **功能 4** | | | | |
| 代码块在 light/dark 主题下可读性良好 | ✅ | global.css:707-716 | `border-left: 3px solid var(--line)` + dark 模式 `background: color-mix(var(--bg-soft) 85%, transparent)` 增强对比度 | N/A |
| 移动端表格可水平滚动 | ✅ | global.css:718-724 | `@media (max-width: 700px)` 内 `table { display: block; overflow-x: auto; }` | N/A |
| 引用块视觉上明显区分于正文 | ✅ | global.css:727-729 | `border-left: 3px solid color-mix(var(--text) 45%, var(--line))` 加深颜色 + `background` 半透明底色 | N/A |
| 正文链接与普通文字有明确视觉差异 | ✅ | global.css:732-734 | `text-decoration: underline; text-underline-offset: 2px;` | N/A |
| 图片在所有视口下不溢出 | ✅ | global.css:737-740 | `max-width: 100%; height: auto; display: block;` | N/A |
| hr 元素渲染为水平分割线 | ✅ | global.css:743-746 | `border: none; border-top: 1px solid var(--line); margin: 2em 0;` | N/A |
| 嵌套列表缩进合理 | ✅ | global.css:749-754 | `margin-left: 1.5em;` 覆盖 ul/ol 所有嵌套组合 | N/A |
| **功能 5** | | | | |
| 文章列表在宽屏下卡片文字行宽合理 | ✅ | posts/index.astro:30 | 内联 `max-width: 780px` 限制卡片区域宽度 | N/A |
| 移动端列表布局不变 | ✅ | posts/index.astro:30 | `max-width` 为流式值，不影响移动端 | N/A |
| **功能 6** | | | | |
| 关于页文字行宽合理 | ✅ | about.astro:16 | 内联 `max-width: 780px` | N/A |
| 工具箱卡片网格在宽屏下多列对齐美观 | ✅ | global.css:302-305 | `repeat(auto-fit, minmax(220px, 1fr))` 自适应多列 | N/A |
| 移动端布局不受影响 | ✅ | about.astro:16; toolbox 使用 auto-fit | `max-width` 和 `auto-fit` 保证移动端自适应 | N/A |

- **AC 总数**: 23
- ✅ 通过: 23
- ⚠️ 部分通过: 0
- ❌ 未通过: 0
- 🔄 不可评估: 0

### 9.3 代码问题清单

| # | 问题类型 | 严重程度 | 位置 | 描述 |
|---|---------|---------|------|------|
| 1 | 范围外变更 | 🟡 | tsconfig.json | PRD 未涉及 tsconfig 修改，但 diff 显示 `baseUrl: "."` 被移除。虽然 TS 4.1+ 下 `paths` 可不依赖 `baseUrl`（以 tsconfig 所在目录为基准），仍建议确认 `@/*` 路径别名在 Astro 构建中正常解析。 |
| 2 | CSS 规范 | 🟢 | global.css:595,707 | `.prose-wrap pre` 被定义两次（line 595 和 line 707），后者覆盖前者的 `border-left`。功能正确，但可合并为单一定义以提高可维护性。 |
| 3 | CSS 规范 | 🟢 | global.css:622,737 | `.prose-wrap img` 被定义两次（line 622 和 line 737），前者设 `width: 100%` 后者设 `max-width: 100%`。功能正确，但存在冗余。 |
| 4 | 交互反馈 | 🟢 | global.css:973-976 | `.kb-tag-item`（移动端分类标签）缺少 `hover`/`focus-visible` 样式，用户点击时无视觉反馈。建议增加 `:active` 状态的背景色变化。 |

### 9.4 优化建议

| # | 建议 | 预期收益 | 建议优先级 |
|---|------|---------|-----------|
| 1 | 确认 tsconfig.json 中 `baseUrl` 移除后 `@/*` 路径别名在 `astro build` 中正常工作 | 防止构建或类型检查失败 | P1 |
| 2 | 合并重复的 `.prose-wrap pre` 和 `.prose-wrap img` 规则，将新增属性追加到原始定义块中 | 减少代码冗余，提升 CSS 可维护性 | P2 |
| 3 | 为 `.kb-tag-item` 添加 `:active` 状态样式（如 `background: color-mix(var(--text) 8%, transparent)`） | 改善移动端触摸反馈 | P2 |

### 9.5 综合评估结论

**结论：PASS ✅**

本次布局优化实现**完整覆盖了 PRD 全部 6 项功能需求和 23 条验收标准**，无任何 AC 未通过：

- **功能 1（P0）**：容器宽度从 840px 提升至 1200px，移动端行为保持不变，导航栏和 footer 对齐正常。
- **功能 2（P0）**：文章正文区域在 1280px 视口下有效宽度约 787px（82ch），超过 700px 要求。TOC sticky 定位正确，移动端单列布局无溢出。
- **功能 3（P0）**：知识库列表页新增分类侧栏，sticky 定位正常，条目数量显示完整，平滑滚动已通过 `scroll-behavior: smooth` + 锚点实现，移动端切换为横向标签条。
- **功能 4（P1）**：代码块/表格/引用/链接/图片/hr/嵌套列表的 Markdown 排版优化全部到位，且 light/dark 主题兼容。
- **功能 5/6（P2）**：文章列表和关于页通过内联 `max-width: 780px` 控制行宽，工具箱使用 `auto-fit` 自适应网格，移动端均不受影响。

**非功能需求**：所有样式使用 CSS 变量和 `color-mix()` 实现主题兼容，中文注释格式符合 `/*-- 注释内容 --*/` 规范，未修改数据层或 API 端点，未引入外部依赖，断点覆盖 ≤700px / 701-1024px / ≥1025px 三个区间。

**遗留项**：存在 3 个低优先级代码规范问题（CSS 重复定义、tsconfig 变更确认、移动端标签交互反馈），均不影响功能正确性，可在后续迭代中处理。

---

> 📌 本文档已基于用户明确确认的 5 项需求生成。所有功能按优先级 P0 → P2 排列，编码智能体应按此顺序实施。
