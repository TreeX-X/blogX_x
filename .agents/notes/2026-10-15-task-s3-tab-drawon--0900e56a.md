---
{
  "schema": "harness-note/2",
  "id": "0900e56a-1bdc-47cc-b4c5-a83b20fa3841",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-16T07:02:40Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "work": {
    "scope": [{"repoId": "f6f78001-d086-47ba-b627-787ada391296", "paths": ["src/pages/", "src/components/server/", "src/layouts/"]}],
    "acceptanceRefs": [
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/103be143-b533-4628-be5e-22083e313f9a", "criterionId": "AC-1"},
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/103be143-b533-4628-be5e-22083e313f9a", "criterionId": "AC-3"}
    ],
    "verification": [
      {"id": "V-1", "kind": "command", "required": true, "repoId": "f6f78001-d086-47ba-b627-787ada391296", "cwd": ".", "program": "npx", "args": ["astro", "check"]}
    ],
    "review": "independent"
  }
}
---

# S3「服务器」tab + 一笔一笔加载

## Scope

导航新增「服务器」入口 + 路由页；进 tab 触发 **L1 draw-on 加载**（线段空间序渐进 `setDrawRange`，1.5–2.5s，绘图机语汇线性偏机械缓动）；绘毕淡入标注/交互层；`prefers-reduced-motion` 直切静态线稿全显；可选笔尖光点（美化项，时间允许再做）。验收点含首页无变形路径残留复查。

## Acceptance criteria

需求 AC-1（导航入口 + 无残留）、AC-3（一笔一笔 1.5–2.5s 量级、绘毕可用、reduced-motion 直切）。**观感以用户验收为准**。

## Verification

- `npx astro check` 基线不新增（V-1）。
- 进 tab 录屏：线条渐进绘出可辨「一笔一笔」；reduced-motion 直切实证；首页 `PixelCaseHero` 残留 grep 为 0。

## Progress

**tab 壳已提前落地（2026-10-15，应用户「先把 tab 建立起来」指令）**：导航「服务器」入口（`BaseLayout.astro`）+ 路由 `src/pages/server.astro` + 舞台容器（`src/styles/server-case.css`，石板色草稿）。

**draw-on 已实施（2026-10-16 xdo，待用户验收）**：`case-lines.ts` 段序按空间扫描键（y 主导 + x/z 倾斜）排序，`geometry.instanceCount` 渐进揭示（壳体窗 0–0.85、部件窗 0.12–1，壳体先行）；`server-case-scene.ts` tick 驱动 2000ms 时间轴，笔尖柔光 sprite 跟随前沿段中点、绘完淡出，色块/接触阴影在 55% 后 smoothstep 淡入；绘线期间禁拖拽缩放，绘毕解锁并淡入提示行（`ServerCase.tsx` whenDrawn → `is-ready`）。`prefers-reduced-motion` 直切静态全显（含 `setDrawProgress(1)` 兜底——首版漏调致线条停在起始态，已修）。

## Evidence

- 导航入口与路由 200 实证；首页变形路径残留 grep = 0（S1 交付时复查）。
- 墨迹曲线（`_temp/drawon-browser-check.json`，Playwright+Edge）：1568→3937→11339→15354→回落 14459 稳定（回落为色块淡入遮内棱线，设计行为），progressive=true、settled=true、hintReady=true、绘毕拖拽画布变化=true；reduced-motion 150ms 即 14474 全显、hint 即就绪。截图 `_temp/design-demos/drawon-final.png`、`drawon-reduced-motion.png`，已目视。
- `npx astro check`：131 files、10 errors，与基线同数（全在 kv-messages/fun-messages/index/nav-particles 既有文件），本轮文件 0 诊断。

## Handoff

序列门控：完成 → 用户验收 → S4（66c566c7）。依赖：S2（4ba97614）。
