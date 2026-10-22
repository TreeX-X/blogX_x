---
{
  "schema": "harness-note/2",
  "id": "4ba97614-7c20-412e-9ccb-ee1ebe1f2aa4",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-15T15:30:06Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "work": {
    "scope": [{"repoId": "f6f78001-d086-47ba-b627-787ada391296", "paths": ["src/components/server/", "src/styles/"]}],
    "acceptanceRefs": [
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/103be143-b533-4628-be5e-22083e313f9a", "criterionId": "AC-4"},
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/103be143-b533-4628-be5e-22083e313f9a", "criterionId": "AC-2"}
    ],
    "verification": [
      {"id": "V-1", "kind": "command", "required": true, "repoId": "f6f78001-d086-47ba-b627-787ada391296", "cwd": ".", "program": "npx", "args": ["astro", "check"]}
    ],
    "review": "independent"
  }
}
---

# S2 L1 线条渲染 + 石板色设计语言

## Scope

**开工门②（用户拍板）**：「石板色」语义——深石板底（tab 有界深色）vs 浅石板底 + 深线；与暖纸+牛血 token 族的关系（新增 token 族 / tab 局部换肤）。

在 S1 底模上落地线条渲染层：`EdgesGeometry` 提特征棱线（L1 常显层）→ fat lines（three examples `LineMaterial`，线宽两级 L1 2.5–3px / L2 预留 1–1.5px）；石板色 token 定案并落地；45° 全景构图；发光只给线条与接点（反 slop）；可选关键面半透明淡填充。**本期不含** L2 内容与 draw-on（S3/S5 管）。

## Acceptance criteria

需求 AC-4（石板色协调，**以用户验收为准**）+ AC-2 的 45° 全景观感（L1 构图清晰、远看可读）。

## Verification

- `npx astro check` 基线不新增（V-1）。
- 45° 全景截图走查：L1 构图/线宽两级/发光克制；色值溯源无 token 族外颜色（新 token 族须在定案中列出）。

## Progress

**L1 线条渲染已落地（2026-10-16），视觉语言经两轮迭代定稿：线条绘画感 + 浅系土黄**。开工门②历程：用户先拍「浅色石板+深线」，再精修为「线条绘画感觉 + 浅系土黄」——最终实施：填充全部平涂化（`MeshBasicMaterial` 无光影，色块+线稿的插画质感）；色板切浅土黄（`case-model.ts` C 谱：#c9b48a 族）；线条深棕两级（壳体 2.0px #5a4826 / 部件 2.9px #2a2010）；舞台纸面浅土黄渐变 + 纸纹颗粒（`server-case.css`）；three shim 补 `three/examples/jsm/*` 声明；fat-lines 经 `case-lines.ts`（EdgesGeometry 25° → `LineSegments2`，按部件分组）。S1 验收通过（用户 2026-10-16「这样的底模布局就好多了」）。

## Evidence

- `npx astro check` 10 errors 基线不变（121 files）。
- 截图：`server-s12.png`（浅石板初版）→ `server-s13.png`（浅土黄线稿画定稿）。

## Handoff

序列门控：完成 → 用户验收 → S3（0900e56a）。开工门②未拍板不得进入实现。依赖：S1（3ac76960）。
