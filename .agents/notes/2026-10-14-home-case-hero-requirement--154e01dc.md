---
schema: harness-note/1
id: 154e01dc-39a1-4a08-80d8-74f652b7bd91
kind: requirement
lifecycle: proposed
created: 2026-10-14
updated: 2026-10-14T16:40:00Z
class: architecture
---

# 首页机箱 Hero：像素变形入场的红橙纸板壳可交互机箱

> **⚠️ 方向变更（2026-10-15）**：用户明确否决红橙纸板壳画风（「我不喜欢现在的纸板画样式」）。本 Note 的 Goal 与 AC-2 画风目标由[像素数码 3D 机箱 Hero 需求](2026-10-15-pixel-case-hero-requirement--f47e324c.md)取代。已验收证据保留作历史；「原位变化」形态、部件→栏目映射与就近卡片交互模型继续有效。实现分析见[想法 Note](2026-10-15-idea-pixel-hero-implementation--5d968c9f.md)。

## Goal

点击首页 hero 标题「树码空间」，像素字融散并盖印成一台**红橙纸板壳手绘机箱**（原位变化，首页其余部分不变）；机箱各部件承载站点栏目的内容入口，是首页的空间化导航。质量门槛：纸板细节做到 120% 的签名级插画，不是 SVG 剪影或照片贴图。

## 当前形态（定案取舍见[决策 Note](2026-10-14-decision-case-hero-design--b56db041.md)）

- **画风**：红橙纸板壳（牛皮纸板模型语言：折边/瓦楞/胶带/丝印/齿孔/纸绳），红橙牛皮色板 + 深可可/奶油印色；ox 血红只留标注层。
- **形态**：内置组件（`CaseSvg.tsx` 插画 + `CaseHero.tsx` 编排）挂在 hero 标题槽位，点击后 hero **原地展开**，不遮罩不换页。
- **入场**：像素「融化—盖印」双向过渡（标题融散、机箱对角波次盖印、矢量 0.55–0.85 交棒）；「变化回」按钮 / Esc 逆向。
- **交互**：引线标注（编号+名称）+ 点击腾开空间 + 卡片就近标识线 + 聚焦态卡片即标签 + 部件本体发光描记（奶油聚光）。

## 内容映射（机箱部件 → 站点栏目）

映射逻辑：**部件的硬件职能 = 栏目的内容职能**。已落地 5 标注；其余为备选映射库（全表与脑洞见[想法 Note](2026-10-14-idea-case-hero-concepts--60adaca4.md)）。

| 标注 | 部件 | 硬件职能 | 映射内容 | 卡片/交互 |
|---|---|---|---|---|
| 01 | CPU 一体式水冷头 | 思考核心 | AI 搜索与翻译管线（鳍片 = 向量索引 `blog_index`） | 路由 chip → posts / knowledge-base |
| 02 | 显卡 · 渲染单元 | 渲染力 | 知识图谱（可视化即渲染） | 描述卡 |
| 03 | 9.2" LCD 仪表屏 | 实时仪表 | 站点内容计数（七集合实况上屏） | 计数卡片（构建期下传） |
| 04 | 侧置风扇组 | 呼吸氛围 | fun-messages 氛围流 | 路由 chip → about |
| 05 | 电源仓 PSU 舱 | 能量来源 | 关于我 + 灵感箱 idea box | 路由 chip → about |

备选（未设标注，扩容取用）：RAM→知识库分类、主板→站点总线图、硬盘→projects/repos、水冷回路→内容冷链、背部理线→CI、前置 I/O→MCP 端口。文案素材（曾为标注后移除）：侧透玻璃→园中主景、贴纸→toolbox/skills、铭牌柱→MCP/API。

## 约束

- **不引入暗色主题**（`wiki/08-constraints.md`）：机箱活在暖纸语言里；变形前后设计 token 不变。
- **原位变化**：不遮罩、不换页、不锁滚动；首页其余部分全程在场。
- **支持移动端**：点按选中 + 底部卡片；移动端隐藏引线标签只留编号。
- **反 slop**：无紫渐变、无装饰性 emoji 图标、无圆角卡左 border accent；不凭空发明颜色。
- **像素变形介质**：复用 `PixelWaveTitle.tsx` 的 canvas 像素网格作为变形源。
- `npx astro check` 不得新增报错（基线 10 error）。

## 否决的替代

照片素材（ROG 热点版）、蓝图剖视终态、真 3D、全屏 overlay、长途飞行 morph、爆炸图/玻璃橱窗方向——理由与重审信号见[决策 Note](2026-10-14-decision-case-hero-design--b56db041.md)。

## 开放项

- **帧率压测**（AC-5 缺口）：肉眼流畅，未跑性能采样。
- **卡片跳转深度**：现为栏目级路由 chip；内容级跳转/来源高亮未定。
- **可及性退化**：`prefers-reduced-motion` 直切未加。
- **双语**：卡片与标注文案 en 版未做。
- 备选部件扩容、动效调参等按需项见[想法 Note](2026-10-14-idea-case-hero-concepts--60adaca4.md)「后续可能」。

## Acceptance criteria

- [x] AC-1: 点击 hero「树码空间」触发像素变形入场，且**原位变化**（不遮罩、不换页，首页其余部分全程在场）；支持逆向变化回标题。两个方向均为一次连续的「融化—盖印」运动，无整页淡切、无糊状中段。（2026-10-14 入站实现并 Playwright 实证双向）
- [x] AC-2: 机箱为红橙纸板壳画风高精度 SVG——牛皮纸板模型（折边/瓦楞/胶带/丝印/纸绳），红橙牛皮色板 + 深可可/奶油印色，标注引线齐备；非 RGB 电竞风、非照片、非粗劣剪影。LCD 丝印屏上屏站点实况计数。
- [x] AC-3: 机箱标注部件 5 项（01–05：CPU 水冷头 / 显卡 / LCD 仪表屏 / 侧置风扇组 / 电源仓）各承载映射内容并有 hover / click 反馈；hover/选中时部件本体发光描记；点击后机箱腾开空间、卡片就近标识线、聚焦态卡片即标签。玻璃面板 / 贴纸区 / 铭牌柱不设标注。
- [x] AC-4: 不引入暗色主题变体，设计 token 不变；`npx astro check` 10 errors 与基线逐项一致（新组件 0 error，2026-10-14 实跑）。
- [ ] AC-5: 可退回标题态（关闭或 ESC），交互帧率稳定，无布局跳动。——退回与 Esc 已实证；**帧率未压测**，压测未做不记通过。
- [x] AC-6: 开放项在实施前得到用户确认并回填本文，不带着未决项开工。

## Relations

- 取舍定案：[决策：机箱 Hero 的画风、形态与变形编排](2026-10-14-decision-case-hero-design--b56db041.md)
- 概念与脑洞：[想法：机箱 Hero 的概念、映射脑洞与后续可能](2026-10-14-idea-case-hero-concepts--60adaca4.md)
- 实现（2026-10-14 入站）：`src/components/CaseSvg.tsx`、`src/components/CaseHero.tsx`、`src/styles/case-hero.css`、`src/pages/index.astro` hero 区（入口反向注释在场）；像素标题复用 `src/components/PixelWaveTitle.tsx`。
- 约束来源：`wiki/01-identity.md`、`wiki/08-constraints.md`。内容真源：[内容云化需求](2026-10-05-content-cloud-requirement--675d3c93.md)。
