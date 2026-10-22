---
{
  "schema": "harness-note/2",
  "id": "c2b24783-5056-49b0-8b8b-5b615b58ff7d",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-15T06:39:52Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "work": {
    "scope": [{"repoId": "f6f78001-d086-47ba-b627-787ada391296", "paths": ["src/components/voxel-case.ts", "src/components/pixel-case-scene.ts"]}],
    "acceptanceRefs": [
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/622719f9-7e68-48d2-ad6b-ed0d318e415a", "criterionId": "AC-1"},
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/622719f9-7e68-48d2-ad6b-ed0d318e415a", "criterionId": "AC-6"}
    ],
    "verification": [
      {"id": "V-1", "kind": "command", "required": true, "repoId": "f6f78001-d086-47ba-b627-787ada391296", "cwd": ".", "program": "npx", "args": ["astro", "check"]}
    ],
    "review": "independent"
  }
}
---

# T1 体素精度提档与细节重画

## Scope

`voxel-case.ts` 体素密度提档（W/H/D 现 52×78×38，目标单体素显示粒度 ≤8 CSS px，网格约 1.5–2× 线性加密）并按新分辨率重画细节清单：外框、玻璃侧透、主板、显卡双风扇叶、水冷头与管路、冷排鳍片、电源仓、LCD 开孔、前置 I/O。细节须在新分辨率下肉眼可辨，不再呈 1–2 格噪点。LCD 贴图平面与体素语言的接缝处理随本次一并裁量。`lite` 降档同步重标定。实例预算服从 AC-6 帧率约束，分档由实现方裁量。

不改配色语义（T2 管）、不改相机/交互（T3 管）、不改变形（T4 管）。

## Acceptance criteria

修复需求 AC-1、AC-6（见 work.acceptanceRefs）。**AC-1 视觉可辨识以用户验收为准**；帧率压测记录留存。

## Verification

- `npx astro check` 10 error 基线不新增（V-1）。
- Playwright/截图对照：九项细节清单逐项可辨；机箱态 idle rAF dt median ≤16ms、变形期 p95 ≤20ms。

## Progress

未开始。逐项门控序列第 1 项；用户验收通过后才进 T2。

## Evidence

（待补）

## Handoff

序列门控：本项完成 → 用户验收 → T2。依赖：无（序列首项）。
