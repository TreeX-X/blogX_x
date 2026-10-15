---
{
  "schema": "harness-note/2",
  "id": "8004ac41-8a04-4289-b2ab-ee1b40ac0ad5",
  "kind": "requirement",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-15T01:42:47Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# 需求：hero 像素标题「树码空间」的指针交互响应

用户需求（2026-10-15）：「树码空间」本身就会像素波动，但希望鼠标移到字样时也影响其显示，并且随鼠标移动而改变。

## Expected behavior

在 `PixelWaveTitle` 既有自主波动（对角行波、扫描线、微浮）之上叠加指针响应：

- 指针进入字样区域：像素显示随指针位置与移动**连续**改变（局部位移/亮度/尺寸的实时扰动，不是一次性动画）；
- 指针离开：扰动平滑回弹，恢复纯自主波动，无残影、无跳变；
- 仅 hero 标题态启用；顶栏 brand 等其它用法保持现状。

## 边界与约束

- 不改文本采样管线（文本→布尔网格），只增绘制期动态项；复用现有 rAF 循环，不另起循环。
- 坐标换算须计入 CSS 缩放与 dpr 变换（画布属性尺寸 ≠ 显示尺寸）。
- 进入机箱变形后冻结指针影响；点击瞬间的扰动态像素作为打散变形源（与[机箱 Hero 需求](2026-10-15-pixel-case-hero-requirement--f47e324c.md)衔接）。
- 触控设备无指针场，保持自主波动；`prefers-reduced-motion` 降档（位移减弱或仅亮度响应）。
- `npx astro check` 不得新增报错（基线 10 error）。

## Acceptance criteria

- [x] AC-1: 指针移入 hero「树码空间」字样区域，像素显示随指针位置与移动实时变化（至少：局部位移 + 亮度响应，且连续跟踪）。（2026-10-15 Playwright 实证：hover 均值差分 maxAbs 137 vs 噪底≈42，argmax 落在指针位 ±8px；P1→P2 差分随移动迁移；近景 `_temp/design-demos/closeup-hover.png` 可见位移+提亮。）
- [x] AC-2: 指针离开后扰动平滑回弹至自主波动，无残影/跳变。（2026-10-15 实证：leave 后差分回落至噪底 mad 8.97≈触控对照 8.16；`verify-4-leave.png`/`closeup-leave.png` 字形回稳；位移经 lerp 回弹无跳变。）
- [x] AC-3: 触控设备与顶栏 brand 标题行为不变；`prefers-reduced-motion` 下位移减弱或仅亮度。（2026-10-15 实证：合成 pointerType=touch 后差分≈噪底 8.16；brand 由 `isScrollBrand` 门控不挂监听且其 `animated=false` 静态画布；reduced-motion 下位移归零、保留亮度/尺寸响应，hover maxAbs 137→98（位移涂抹消失）。）
- [x] AC-4: 标题动画帧率与现状同级稳定；`npx astro check` 无新增报错。（2026-10-15 实证：hover 中 rAF 间隔 median 13.3ms / p95 13.4ms；`npx astro check` 10 errors 与基线逐项一致。）

## Relations

- 实现分析：[想法：像素 Hero 的实现分析](2026-10-15-idea-pixel-hero-implementation--5d968c9f.md)
- 衔接需求：[像素数码 3D 机箱 Hero](2026-10-15-pixel-case-hero-requirement--f47e324c.md)（点击后扰动态像素 = 打散源）
- 现实现：`src/components/PixelWaveTitle.tsx`（draw 循环与波形参数）；hero 用点：`src/components/CaseHero.tsx` 标题槽位。
