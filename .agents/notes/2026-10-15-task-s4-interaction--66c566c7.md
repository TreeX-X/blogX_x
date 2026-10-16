---
{
  "schema": "harness-note/2",
  "id": "66c566c7-f1eb-4161-9d77-d8ce70a13f09",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-16T09:26:28Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "work": {
    "scope": [{"repoId": "f6f78001-d086-47ba-b627-787ada391296", "paths": ["src/components/server/"]}],
    "acceptanceRefs": [
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/103be143-b533-4628-be5e-22083e313f9a", "criterionId": "AC-2"}
    ],
    "verification": [
      {"id": "V-1", "kind": "command", "required": true, "repoId": "f6f78001-d086-47ba-b627-787ada391296", "cwd": ".", "program": "npx", "args": ["astro", "check"]}
    ],
    "review": "independent"
  }
}
---

# S4 交互层（全景态）

## Scope

复用 `public/3d-poc/` 骨架：限角轨道相机（拖拽 ±50°/俯仰限幅/滚轮缩放，**禁自转**）；透明实体拾取层；hover 预亮；点击部件 → 高亮 + 就近信息卡（映射文案为需求 2026-10-16「机箱即我」五模块，无路由跳转；风扇不做标识与卡片）；常驻引线标注（编号+名称，3D 锚点投影 + SVG 引线跟随相机）；Esc/关闭/点空白收起。本任务止于全景态交互——「点击拉近 × 细节丰富」归 S5。

## Acceptance criteria

需求 AC-2 的全景态交互部分（见 work.acceptanceRefs）。**手感以用户验收为准**。

## Verification

- `npx astro check` 基线不新增（V-1）。
- 实证：idle 30s 无自转；五部件 hover/点击/出卡/引线跟随逐项通过；拖拽限角不穿模。

## Progress

**全景态交互已实施（2026-10-16 xdo；同日按用户反馈细化引线与卡片，待用户验收）**：

- 拾取与相机：`server-case-scene.ts` 复用限角轨道相机（拖拽 ±、俯仰限幅、滚轮缩放，禁自转不变），新增射线拾取——以部件同形实体网格（`partGroups` 内 mesh 挂 `userData.partKey`）为命中层，线条过细不参与拾取；`drawn` 前禁交互。拖拽与点击按位移阈值（>4px）区分。相机阻尼残差小于阈值即吸附目标值，消除渐近蠕动。
- 标注：`onFrame` 每帧把五部件锚点（`partAnchors`）投影到画布像素（`AnchorScreen`，坐标取整到 CSS 像素），`ServerCase.tsx` 据此定位**横折引线**（锚点→斜段→折点→水平段接入槽位端的三折点折线）与标签；DOM 写入带变更检测（静置零写入，消除亚像素抖动），标签尺寸只在容器尺寸变化与字体就绪时测量。锚点离开视锥/在相机后方时该组隐藏。
- hover/选中：`onHover`/`onSelect` 回调；`case-lines.ts` 新增 `setPartEmphasis(key, level)`，线色向牛血红偏移、线宽提升（hover 0.45 / 激活 1）。
- 卡片：点击后信息卡**原位替换**该部件标签（同一侧槽位、标签隐藏），引线水平段改接卡片内缘；内容为需求「机箱即我」五模块文案，无路由跳转；Esc/关闭按钮/点空白收起，收起时卡片归位（避免残留坐标在窄视口溢出）。
- 内容映射落到部件组：**新增 `ram` 部件组**并从 `mb` 拆出四条 DIMM（需求实现注记所要求的独立拾取组与锚点，避免与主板卡命中冲突），`mb` 锚点改为主板托盘位；**风扇为纯结构件**不参与拾取/标注/卡片。
- 标注文案（编号+名称）：01 CPU 水冷头 / 02 显卡·渲染单元 / 03 内存条 ×4 / 04 电源仓 / 05 主板。需求映射表 03↔内存条、04↔电源仓、05↔主板编号照此落地。

## Evidence

- `node _temp/verify-server-interaction.mjs`（Playwright + Edge，本机现有外部安装，`npm` 无新增依赖）全 17 项通过，日志 `_temp/server-interaction-check.json`：五模块标注常驻、引线横折三折点且静置 1s points 字符串零变化（无抖动）、拖转后锚点投影变化（引线跟随）、hover 命中 `pointer`/`is-hover`、点击部件出卡且卡片原位替换标签（标签透明、与标签同侧槽位对齐 ±4px）、点空白/Esc/关闭收起、五标签逐项点击出卡、idle 漂移 0（无自转）、390×844 无横向溢出且移动卡片可用、reduced-motion 直切、页面与控制台错误 0。截图 `_temp/design-demos/server-interaction-desktop.png`、`server-interaction-mobile.png`、`server-card-open-desktop.png`、`server-card-open-gpu.png`，已目视桌面与手机。
- `npx astro check`：**139 files / 10 errors**，与既有基线同数（全部落在 kv-messages / fun-messages / index.astro / nav-particles 既有文件），本轮服务器文件 0 诊断。注：本机 `astro check` 默认堆会 OOM，需 `NODE_OPTIONS=--max-old-space-size=8192` 方能跑完。

## Handoff

序列门控：完成 → **用户验收（本任务 `review: independent` 的独立复核仍未履行）** → S5（d1608809）。依赖：S3（0900e56a，已用户验收）。
