---
{
  "schema": "harness-note/2",
  "id": "66c566c7-f1eb-4161-9d77-d8ce70a13f09",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-16T06:27:06Z",
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

未开始。序列门控第 4 项；前置 S3 用户验收。

## Evidence

（待补）

## Handoff

序列门控：完成 → 用户验收 → S5（d1608809）。依赖：S3（0900e56a）。
