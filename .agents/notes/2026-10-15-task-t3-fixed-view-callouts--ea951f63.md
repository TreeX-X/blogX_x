---
{
  "schema": "harness-note/2",
  "id": "ea951f63-26c2-4a73-bea8-693d3b7e0aaa",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-15T06:39:52Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "work": {
    "scope": [{"repoId": "f6f78001-d086-47ba-b627-787ada391296", "paths": ["src/components/pixel-case-scene.ts", "src/components/PixelCaseHero.tsx", "src/components/voxel-case.ts", "src/styles/pixel-case.css"]}],
    "acceptanceRefs": [
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/622719f9-7e68-48d2-ad6b-ed0d318e415a", "criterionId": "AC-3"}
    ],
    "verification": [
      {"id": "V-1", "kind": "command", "required": true, "repoId": "f6f78001-d086-47ba-b627-787ada391296", "cwd": ".", "program": "npx", "args": ["astro", "check"]}
    ],
    "review": "independent"
  }
}
---

# T3 固定 45° 全景 + 常驻引线标注

## Scope

交互模型换轴（落实用户 2026-10-15 口径，废 EB-5/EB-6）：

1. **相机恒定**：删空闲自转与逐件机位飞转（`PART_POSES` 逐件位姿退役，保 home 单机位）；固定约 45° 前脸-玻璃象限全景，五部件同框可辨；点击/关闭卡片相机零移动。
2. **常驻标注层**：01–05 引线标注常驻可见（编号 + 名称，引线落部件旁、不遮挡部件）——召回 2026-10-14 CALLOUTS 模型（`CaseSvg.tsx` 可作引线语言参考，勿复活纸板画风）。标注随部件投影走（相机已恒定，也可静态布局）。
3. **交互保留**：hover 预高亮、点击亮起 + 就近卡片（无路由）、Esc/返回按钮。卡片腾位简化（相机不动后仅侧向让位或不让）。

## Acceptance criteria

修复需求 AC-3（见 work.acceptanceRefs）。**视觉以用户验收为准**。

## Verification

- `npx astro check` 10 error 基线不新增（V-1）。
- 实证：idle 30s 相机位姿不变；点击各部件相机矩阵不变；五条标注常驻且不互相遮挡、不压部件。

## Progress

未开始。逐项门控序列第 3 项；前置 T2 用户验收通过。

## Evidence

（待补）

## Handoff

序列门控：本项完成 → 用户验收 → T4。依赖：T2（77f64b89）。
