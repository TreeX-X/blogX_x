---
{
  "schema": "harness-note/2",
  "id": "4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "kind": "module",
  "lifecycle": "accepted",
  "created": "2026-10-15",
  "updated": "2026-10-16T08:50:46Z",
  "moduleState": "implemented"
}
---

# BlogX_x 工程 Notes（项目根模块）

## Responsibility

BlogX_x 工程的持久 agent 记忆库：需求、决策、想法与任务记录，供 WorkflowX 会话与后续开发续接上下文。只记不可从代码直接推导的事实与推理；代码结构、既往修复、git 历史不入库。

## Design

- 平铺 topic Notes，暂无子模块。文件名 `YYYY-MM-DD-<subject>--<id8>.md`；requirement 类以 `-requirement` 作 subject 后缀，decision/idea/task 类把 kind 放日期后（沿用 corpus 惯例）。
- 类型纪律：当前设计进 module/主文档，探索进 idea，验收进 requirement，持久取舍进 decision；任务归属随所选工作流。
- 格式：历史 corpus 为 `harness-note/1`（YAML frontmatter，含 `class`）；新写入按 CLAUDE.md 钉定的 `harness-note/2`（JSON frontmatter + `module` 归属此根模块）。`harness.json` 目前仍声明 `standard: harness-note/1`——未擅改，已向用户报告待定。
- 未知即未知：无 desktop 会话、无共享 wiki 索引服务时用有界检索读原始 Notes，并声明覆盖范围。

- 全站视觉：[暖纸工业图解](warm-paper-illustration.md)，统一暖纸 / 墨棕 / 牛血色、纸面细边框与阅读排版；机箱透明嵌入页面，装饰线仅附着实体结构。
- 当前服务器机箱形态：暖色线稿全景玻璃，顶部三风扇冷排 / 薄 CPU 泵头 / 四 DIMM / 横装 FE 显卡 / 底部独立电源仓；ROG 布局适配及验证边界见[服务器需求](2026-10-15-server-tab-linecase-requirement--103be143.md)。
- 机箱内容映射 2026-10-16 定案「机箱即我」五模块（CPU→WorkFlowX、显卡→JanusX、内存条→知识库、电源仓→关于我、主板→中转站留白）；风扇组本期不设计不实施。S4 已按此落地拾取/标注/卡片，并将四条 DIMM 从 `mb` 拆为独立 `ram` 拾取组。

## Related documents

- 维护入口：noteX；任务生命周期经 orchestrateX 各模式。
- 工程上下文：`wiki/README.md`（工程 wiki，非本库）。
- 爱好展示探索：[热爱空间与好奇心工作台](2026-10-16-idea-interest-workbench--069c5337.md)，记录火箭 / 汽车 / AI 与 Vitality 观赛收藏；整体仍为草案，关于页顶部五位黄黑队服火柴人捧杯插画已按用户要求实施。
- 当前活跃主题：**「服务器」tab —— 线条画风 3D 可交互机箱**（[需求](2026-10-15-server-tab-linecase-requirement--103be143.md)）。进度：S1/S2/S3 已用户验收，S4 全景交互层 2026-10-16 已实施待用户验收（[S4](2026-10-15-task-s4-interaction--66c566c7.md)），S5「点击拉近 × 细节丰富」末项待启动（开工门③拉近壳体策略待拍板）；逐项用户验收门控。首页只保留像素标题（变形效果已移除，2026-10-15）；历史主题：像素机箱 Hero 变形（已取代）、纸板壳方向（已否决）、内容云化（2026-10-05）。
