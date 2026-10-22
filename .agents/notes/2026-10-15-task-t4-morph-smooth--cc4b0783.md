---
{
  "schema": "harness-note/2",
  "id": "cc4b0783-c8fb-4d63-8126-9b351369e410",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-15T06:39:52Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "work": {
    "scope": [{"repoId": "f6f78001-d086-47ba-b627-787ada391296", "paths": ["src/components/PixelCaseHero.tsx", "src/components/pixel-case-scene.ts"]}],
    "acceptanceRefs": [
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/622719f9-7e68-48d2-ad6b-ed0d318e415a", "criterionId": "AC-4"}
    ],
    "verification": [
      {"id": "V-1", "kind": "command", "required": true, "repoId": "f6f78001-d086-47ba-b627-787ada391296", "cwd": ".", "program": "npx", "args": ["astro", "check"]}
    ],
    "review": "independent"
  }
}
---

# T4 像素→机箱变形丝滑化

> **❌ 作废（2026-10-15 晚）**：用户取消「像素→机箱」变形需求（标题与机箱改为并置共存），本任务随[修复需求冻结](2026-10-15-pixel-case-repair-requirement--622719f9.md)一并作废。

## Scope

重做打散重组编排，消除「生硬」三成因：

1. **消灭交棒空窗**：`enterCase` 先预载场景（title 态 hover/空闲预取 three + 建场）或标题保持到粒子接管后再淡出——首点冷加载不得出现空白帧。
2. **真像素对应**：标题像素按 PixelWaveTitle 网格对齐采样（弃 step 稀疏采样），每体素/粒子直飞各自目标位的短程路径；**弃 26–60 单位爆散长弧**（2026-10-14「长途飞行糊成色块」教训不得重演）。
3. **连续观感**：分段缓动 + 错峰拖尾；2D 标题方块与 3D 体素交棒时形态/明度连续；`morphOut` 逆向同标准。

T3 落地后做（相机恒定使播种平面稳定）。

## Acceptance criteria

修复需求 AC-4（见 work.acceptanceRefs）。**观感以用户验收为准**。

## Verification

- `npx astro check` 10 error 基线不新增（V-1）。
- 首次进入（冷加载路径）录屏无空白帧；正逆向各 3 次连续无糊状中段；reduced-motion 直切保留。

## Progress

未开始。逐项门控序列第 4 项；前置 T3 用户验收通过。

## Evidence

（待补）

## Handoff

序列门控：本项完成 → 用户验收 → T5。依赖：T3（ea951f63）。
