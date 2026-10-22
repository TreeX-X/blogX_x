---
{
  "schema": "harness-note/2",
  "id": "77f64b89-ad14-4d18-a700-02bf8ec9aa8b",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-15T06:39:52Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "work": {
    "scope": [{"repoId": "f6f78001-d086-47ba-b627-787ada391296", "paths": ["src/components/voxel-case.ts", "src/components/pixel-case-scene.ts"]}],
    "acceptanceRefs": [
      {"uri": "note://f6f78001-d086-47ba-b627-787ada391296/622719f9-7e68-48d2-ad6b-ed0d318e415a", "criterionId": "AC-2"}
    ],
    "verification": [
      {"id": "V-1", "kind": "command", "required": true, "repoId": "f6f78001-d086-47ba-b627-787ada391296", "cwd": ".", "program": "npx", "args": ["astro", "check"]}
    ],
    "review": "independent"
  }
}
---

# T2 配色与光照重调（blog 画风归位）

## Scope

重调 `voxel-case.ts` 色板分配与 `pixel-case-scene.ts` 光照：牛血升为箱体第一识别色（结构色而非点缀），暖纸降灰作主面，消除大面积 ink/shadow 灰块的「通用科技灰」观感；机箱对 `--bg` 图底可分。色值仍全部取 global.css token 族，不发明新颜色、不设深色面板。LCD 深色屏处理随本次裁量（限缩面积或改浅）。光照塑形（对比度/描边感）随配色一并重调。

在 T1 的新分辨率结构上做，不回改几何布局。

## Acceptance criteria

修复需求 AC-2（见 work.acceptanceRefs）。**视觉以用户验收为准**。

## Verification

- `npx astro check` 10 error 基线不新增（V-1）。
- 截图对照 blog 画风（暖纸 + 牛血，ref. ljj.world 语感）；色值溯源检查：无 token 族外颜色。

## Progress

未开始。逐项门控序列第 2 项；前置 T1 用户验收通过。

## Evidence

（待补）

## Handoff

序列门控：本项完成 → 用户验收 → T3。依赖：T1（c2b24783）。
