---
{
  "schema": "harness-note/2",
  "id": "3ac76960-0fc4-4668-bc26-b23a2f7f8188",
  "kind": "task",
  "lifecycle": "draft",
  "created": "2026-10-15",
  "updated": "2026-10-16T04:15:29Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "work": {
    "scope": [{"repoId": "f6f78001-d086-47ba-b627-787ada391296", "paths": ["src/components/server/", "public/models/"]}],
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

# S1 形态底模（精度之源）

## Scope

**开工门①（用户拍板）**：精度路线 A（高精度 GLB 资产采购/授权接入）vs B（程序化精修几何）——见[实现分析](2026-10-15-idea-linecase-implementation--3f2a81c0.md)成本/上限表。

产出线条提线可用的机箱底模：五部件按组分结构（cpu/gpu/lcd/fans/psu + 壳体），形态辨识度对齐参考照片（`_temp/design-demos/assets/rog-cronox/` 作形态标尺，不使用其图形资产）；侧透 3/4 视角下水冷/显卡双风扇/LCD/风扇组/电源仓可认。A 路线含 GLB 清洗与部件分组；B 路线含精修建模（网孔/线材/螺丝等微细节）。

## Acceptance criteria

需求 AC-2 的形态部分（见 work.acceptanceRefs）：五部件可认、对齐参考照片识别度。**以用户验收为准**。

## Verification

- `npx astro check` 基线不新增（V-1）。
- 底模 45°/侧透截图与参考照片并排比对，五部件逐项可认。

## Progress

**底模已搭建（2026-10-15），待用户验收**。开工门①按用户指令定为 B 路线（程序化精修，「按照参考图片搭建一个底模」）：`src/components/server/case-model.ts`（W54×H92×D58，玻璃 +x / 前脸 -z，五部件分组 + 锚点）+ `server-case-scene.ts`（45° 机位 az=+135° 限角拖转）+ `ServerCase.tsx` 岛 + `src/pages/server.astro`。截图自查：玻璃侧透/前脸风扇柱/品牌竖条/LCD/电源仓/水冷管路与参考图布局一致（构图与玻璃框条 bug 已修两轮）。

**2026-10-16 显卡 FE 重做**（用户反馈「太厚重」+ 指令参考英伟达官方显卡还原）：卡身比例修薄 `32×13×44` → `12×25×45`（对齐官方 304×137×61 三槽比例，金手指侧贴主板 PCIe）；设计语言按 NVIDIA Founders Edition 补齐——机加工棱框（上下长棱 + 前端框）、玻璃侧鳍片梳（18 鳍）、GEFORCE 字带铭牌（抽象字块 + 牛血灯带）、顶置 12VHPWR 供电口位、底置贯穿双风扇（八角开孔环）、后缘 IO 挡板（接口槽 + 散热缝 + 螺丝耳）；主板 PCIe x16 槽下移对齐金手指底棱 y≈-18（M.2 随之就位）。锚点移至字带面。

## Evidence

- `npx astro check` 10 errors 基线不变（120 files）。
- **2026-10-15 高保真校准轮**（按素材库 catalog-1/2 + lcd-screen 规格）：视角改玻璃侧主导（az 135→118°，与 catalog-1 透视比率吻合）；LCD 改 9.2" 超宽条屏（1920×462≈4.15:1）斜置面向玻璃-前脸角平分（修了法向反 180° 的朝向 bug）；补顶部 IO 条、前柱 Logo+竖排丝印、后上风扇方形支架、中部竖置格栅支架、电源仓铭牌/散热槽；显卡加长；泵头加大。截图 `server-s2.png` → `server-s5.png`。
- **2026-10-16 显卡 FE 重做**：`npx astro check` 10 errors 基线不变（122 files）；目视自查 `_temp/design-demos/server-gpu-fe.png`、`gpu-crop-default|drag|drag2.png`（Playwright+Edge 截图，人工目视）：卡身修长不再厚重，棱框/鳍片梳/字带/IO 挡板/底置风扇可认，与 CPU/内存/电源仓无穿插。机箱整机标尺仍为 ROG 参考图；显卡形态基准为 NVIDIA 官方 FE 设计语言（尺寸口径 nvidia.com：RTX 4090 FE 304×137×61mm/3 槽）。

## Handoff

序列门控：完成 → 用户验收 → S2（4ba97614）。开工门①未拍板不得进入实现。
