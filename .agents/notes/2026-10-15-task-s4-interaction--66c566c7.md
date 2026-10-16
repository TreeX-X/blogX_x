---
{
  "schema": "harness-note/2",
  "id": "66c566c7-f1eb-4161-9d77-d8ce70a13f09",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-16T09:48:58Z",
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
- 标注：投影前显式更新相机矩阵，并在同帧模型渲染后发出 `onFrame`，消除读取上一帧矩阵造成的跟随滞后；投影保留 0.01 CSS 像素精度，避免整像素阶跃。引线为水平—垂直—水平的四顶点直角折线；DOM 坐标写入带变更检测，标签尺寸在舞台尺寸变化与字体就绪后测量。锚点超出深度裁剪范围时隐藏引线组。
- hover/选中：`onHover`/`onSelect` 回调；`case-lines.ts` 新增 `setPartEmphasis(key, level)`，线色向牛血红偏移、线宽提升（hover 0.45 / 激活 1）。
- 卡片：标签和卡片共用固定槽位内缘，展开和收起保持整条引线几何不变；卡片直接替换文字，不再位移动画或淡入叠字。使用 `useLayoutEffect` 在浏览器绘制前定位，避免切换时闪现旧位置；靠近底部向上避让，手机保留原位卡片，标签允许换行。内容与 Esc/关闭/空白收起逻辑沿用原实现。
- 避让：桌面独立两侧标注区与中央模型画布，手机上下标注区与中央模型画布；投影补偿画布在舞台内的偏移。主板放在显卡上方，折线竖段分配独立通道（主板/显卡相隔 22px）。标签宽度使用 `max-content` 配合区宽上限，防止 resize 时旧的定位值改变文本换行、导致测量高度与引线端点错位。
- 内容映射落到部件组：**新增 `ram` 部件组**并从 `mb` 拆出四条 DIMM（需求实现注记所要求的独立拾取组与锚点，避免与主板卡命中冲突），`mb` 锚点改为主板托盘位；**风扇为纯结构件**不参与拾取/标注/卡片。
- 标注文案（编号+名称）：01 CPU 水冷头 / 02 显卡·渲染单元 / 03 内存条 ×4 / 04 电源仓 / 05 主板。需求映射表 03↔内存条、04↔电源仓、05↔主板编号照此落地。

## Evidence

- 当前回归：`scripts/test-server-callouts.mjs`（外部 Playwright + Edge，`PLAYWRIGHT_MODULE` 指向本机安装）通过：四顶点直角几何、拖转后 90 帧锚点方向不反复、阻尼结束后静置 1.2s 全部引线字符串不变；五部件 × 1440/768/390/320px 展开与收起的引线几何完全一致，标签隐藏、卡片内缘对齐、端点仍连接卡片且卡片在舞台内、文档无横向溢出；reduced-motion 点击与关闭、浏览器错误 0。桌面/手机截图位于系统临时目录 `server-callout-1440.png` / `server-callout-390.png`，已目视。本轮是主 Agent 自验，独立复核仍待履行。
- 避让回归纳入同一脚本：上述四种屏宽下，全部标签距模型画布至少 20px、卡片不侵入模型画布、左右各部件竖折通道独立，主板与显卡通道相距至少 20px；resize 后引线端点与标签中心对齐误差小于 1px。标签截图位于系统临时目录 `server-labels-1440.png` / `server-labels-390.png`。

- 旧临时回归 `node _temp/verify-server-interaction.mjs` 本轮复跑：hover、实体点击出卡、空白/Esc 收起、五标签点击、idle 漂移 0、390×844 手机交互与 reduced-motion 均通过；其中“三顶点折线”断言已不符合当前四顶点设计，不作为当前几何证据，当前几何由正式脚本验证。
- `npx astro check`：**140 files / 10 errors**，与既有基线同数（全部落在 kv-messages / fun-messages / index.astro / nav-particles 既有文件），本轮服务器文件 0 诊断。日志 `_temp/server-callouts-astro-check.txt`。注：本机 `astro check` 默认堆会 OOM，需 `NODE_OPTIONS=--max-old-space-size=8192` 方能跑完。

## Handoff

序列门控：完成 → **用户验收（本任务 `review: independent` 的独立复核仍未履行）** → S5（d1608809）。依赖：S3（0900e56a，已用户验收）。
