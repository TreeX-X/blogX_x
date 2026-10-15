---
{
  "schema": "harness-note/2",
  "id": "4d500b85-a071-45ab-adb0-c1c2ff26790d",
  "kind": "module",
  "lifecycle": "accepted",
  "created": "2026-10-15",
  "updated": "2026-10-14T16:40:00Z",
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

## Related documents

- 维护入口：noteX；任务生命周期经 orchestrateX 各模式。
- 工程上下文：`wiki/README.md`（工程 wiki，非本库）。
- 当前活跃主题：首页 hero 体验（像素标题指针交互、像素数码 3D 机箱 Hero，2026-10-15 两需求）；历史主题：机箱纸板壳方向（2026-10-14，画风已被否决）、内容云化（2026-10-05）。
