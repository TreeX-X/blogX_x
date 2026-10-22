---
{
  "schema": "harness-note/2",
  "id": "17a573c9-bb1e-40d0-8460-4da2beec37e7",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-15T06:39:52Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "work": {
    "scope": [{"repoId": "f6f78001-d086-47ba-b627-787ada391296", "paths": ["src/styles/pixel-case.css", "src/styles/global.css", "src/components/PixelCaseHero.tsx"]}],
    "acceptanceRefs": [
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/622719f9-7e68-48d2-ad6b-ed0d318e415a", "criterionId": "AC-5"}
    ],
    "verification": [
      {"id": "V-1", "kind": "command", "required": true, "repoId": "f6f78001-d086-47ba-b627-787ada391296", "cwd": ".", "program": "npx", "args": ["astro", "check"]}
    ],
    "review": "independent"
  }
}
---

# T5 布局让位自然化

## Scope

重做机箱态让位编排，消除跳变：

1. **图谱下移连续化**：`grid-template-columns` 轨道数不同无法插值是弹跳根因——改 FLIP（先量后动，transform 过渡后落位）或等价编排；`kg-panel` 高度 560→320 同步过渡。
2. **卡片一次定位**：删 0/480/900ms 三次 `setTimeout` 校正；T3 相机恒定后投影一次算准（resize 时重算即可）。
3. **时间线协调**：hero min-height 展开、标题淡出、变形、图谱让位共用协调时长/缓动（对齐 global.css expo-out 语感）；hero 下方控件（副标题/搜索/特性卡）的下推过程可预期、无被拽感。
4. 移动端底部卡片布局不回归。

## Acceptance criteria

修复需求 AC-5（见 work.acceptanceRefs）。**观感以用户验收为准**。

## Verification

- `npx astro check` 10 error 基线不新增（V-1）。
- 进/出机箱各 3 次录屏：图谱一次连续落位、无弹跳；卡片出现后零跳动；移动端点按路径回归通过。

## Progress

未开始。逐项门控序列第 5 项（末项）；前置 T4 用户验收通过。

## Evidence

（待补）

## Handoff

序列门控：本项完成 → 用户验收 → 修复需求整体收口（回填 AC 勾选、更新模块活跃主题）。依赖：T4（cc4b0783）。
