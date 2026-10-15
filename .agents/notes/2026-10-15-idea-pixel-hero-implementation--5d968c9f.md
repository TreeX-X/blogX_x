---
{
  "schema": "harness-note/2",
  "id": "5d968c9f-ed4b-41f2-9802-7c8252c029a3",
  "kind": "idea",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-15T01:42:47Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# 想法：像素 Hero 的实现分析（指针标题 + 3D 像素机箱）

> 分析记录（2026-10-15），对应需求：[像素标题指针交互](2026-10-15-pixel-title-pointer-requirement--8004ac41.md) / [像素数码 3D 机箱 Hero](2026-10-15-pixel-case-hero-requirement--f47e324c.md)。定案前的探索，不是承诺。
>
> **📌 2026-10-15 拍板回填**：需求 2 的推荐路线获采纳——全宽舞台 + 图谱下移 / 暖纸「像素陶瓷」体素 / 卡片仅就近展示（本期无跳转）。定案见[决策 Note](2026-10-15-decision-pixel-case-hero-direction--32ddac56.md)；文中被否的备选（图谱留右侧、深色视窗发光体素、卡片路由 chip）仅作取舍记录。

## 一、需求 1：像素标题的指针交互

### 现状

`PixelWaveTitle.tsx`：文本采样成布尔网格，rAF 循环内对点亮格画方块——对角行波调明暗/尺寸、扫描线增亮带循环扫过、垂直微浮；无任何指针输入。画布 CSS 高度 clamp、`width:auto`、`image-rendering:pixelated`，绘制在 dpr `setTransform` 后的逻辑空间。

### 推荐方案：指针力场叠加进现有绘制循环

1. **指针追踪**：容器监听 `pointermove`/`pointerleave`；rect 在 pointermove 里缓存（不在每帧读布局）。逻辑坐标换算须计入 CSS 缩放（显示尺寸 ≠ `cols*cell`）。
2. **每帧动态项**（加进现有 draw 循环，不另起循环）：
   - 径向位移：以指针为心、R≈80–120 逻辑 px 的衰减场内，点亮格获得斥力位移（smoothstep 衰减；可选 attract / swirl 变体）；
   - 局部响应：场内 alpha、size 抬升；可加波源涟漪（相位随距离偏移，从指针荡开）；
   - 平滑回弹：每格位移向目标 lerp（≈0.12/帧），指针离开后目标归零自然弹回。
3. **衔接**：仅 title 态响应；点击进变形时快照捕捉扰动态像素作为打散源（与需求 2 天然衔接）。
4. **降档**：触控无指针场；`prefers-reduced-motion` 只留亮度响应或全场减弱。
5. **封装**：实现时收敛为沿用组件既有 `brand-wave` 分支门控（非 brand 用法启用指针力场），不加新 prop（2026-10-15；比计划的 `pointerInteractive` prop 更小改动，brand 天然不受影响）。

### 备选

- 只做亮度/相位响应（无位移）：实现最简，观感弱——可作 phase-1 降档。
- CSS 变换/滤镜跟随：丢像素质感，否。
- 双 canvas overlay：重复采样浪费，否。

### 工作量

0.5–1 天（含调参）。

## 二、需求 2：像素数码 3D 机箱 Hero

### 技术选型

- **three（vanilla）单依赖 + 动态 import**：点击时才 `import("three")`（约 150KB gz），首屏零成本；Astro 岛内 useEffect 命令式编排与现有 `PixelWaveTitle`/`CaseHero` 风格一致。不引 react-three-fiber / drei（多依赖，收益主要在声明式状态，本例是集中编排）。
- **程序化体素装配**建模，不用外部 GLTF / 照片资产（承接 2026-10-14 否决照片素材的理由：授权、体积、辨识度）。

### 子系统拆解

1. **布局腾位**：`.home-experience` 加 `case-mode`——grid 过渡为单列（舞台全宽在上、图谱下移），sidebar 位置/顺序过渡（CSS transition，必要时 FLIP）。移动端本就 flex 列且图谱 `order:-1`，机箱态把图谱排到舞台之后即「下移」。桌面端「下移」精确形态待用户确认（开放项）。
2. **打散重组（2D→3D）**：整个变形在 three 场景内做——标题像素采样为 2D 粒子平面（与 `PixelWaveTitle` 同源采样），点击后粒子获得 3D 速度爆散（湍流 + 微旋转），再按体素目标位错峰飞入组装（per-instance 延迟 + 缓动 + 短拖尾）；相机同时轻 dolly-in。教训承接：2026-10-14「长途飞行糊成色块」是 2D 密集格问题，3D 景深 + 错峰下可控，但须避免均匀直线长飞。备选：2D morph canvas 打散后交叉淡化进 3D（省工，但「像素变 3D」交棒是假的）。
3. **体素机箱**：`InstancedMesh`（按部件分 mesh 或全局 mesh + instanceColor），可见壳体体素 2–4 万。程序化装配函数：外框 / 玻璃侧透（半透明体素面）/ 主板 / 显卡 + 叶轮 / 水冷头 + 管路（曲线体素）/ 冷排鳍片 / 电源仓 / LCD 发光屏（像素屏上屏实况计数）/ 前置 I/O / 螺丝胶带细节。每实例带 partId 供拾取。「高精度」=体素分辨率 + 细节清单；先做 30 分钟颗粒度原型定档，再全量装配。
4. **拾取与反馈**：Raycaster → instanceId → partId。hover 提亮；点击：emissive 脉冲（亮起）+ 该部件组 scale 1.04–1.08、其余微弱化（放大）。
5. **相机编排**：每部件一组位姿（azimuth / elevation / distance / lookAt 偏移）；点击后球坐标 easeInOutCubic tween（自动旋转到最佳展示位）；空闲慢速 orbit 自转。落位后投影部件屏幕位置 → 选卡片侧 → 相机 view offset 或舞台容器对侧平移腾位（现 `cardSide`/`cardTop` 逻辑的 3D 版）。
6. **卡片**：`PARTS` 文案数据迁移复用；UI 走像素数码语言（像素描边、等宽小标、扫描线点缀）；路由 chip 保持栏目级（内容级待定）。
7. **状态机**：title → scattering → assembling → case ⇄（选中：cameraTween + cardIn）→ leaveCase 逆向。Esc / 返回按钮沿用现有习惯。

### 性能与降档

- 2–4 万实例 + 变形粒子 1–3k：桌面 60fps 可行；DPR≤2；暖色雾做纵深。
- 移动端：体素密度减半、关自转、粒子减量；`prefers-reduced-motion` 直切（跳过打散，淡入机箱）。
- 帧率压测进验收（补 2026-10-14 AC-5 缺口）。

### 风险

- 体素审美是最大不确定度（颗粒度、细节密度、配色都靠原型调）。
- 打散重组中段观感需调参（错峰 / 缓动 / 拖尾）。
- three 懒加载与 Astro 岛 SSR 兼容（动态 import 放点击后，规避 SSR 窗口）。
- 暖纸约束 vs 「数码味」张力 → 开放项待拍板。

### 工作量

体素建模 3–5 天 · three 舞台 + 变形 2–3 天 · 拾取/相机/卡片 2 天 · 布局/降档/压测 1–2 天 → **约 1.5–2.5 周**（对照 2026-10-14 可行性档：SVG 数天 / 真 3D 数周，体素 3D 居中偏 3D）。

### 与需求 1 的协同

指针力场让标题在点击前「被搅动」，打散源即扰动态像素——两需求共享像素系统，建议同迭代交付（需求 1 先行半天也独立成立）。
