---
title: "Evaluator PRD Audit"
description: "结构化代码审计工作流，支持 PRD 模式和 Prompt 模式，输出结构化评估结果 Payload。"
skillDir: "evaluator-prd-audit"
tags: ["code-audit", "evaluation", "quality-assurance"]
---

## 简介

evaluatorX 的代码审计 skill。在编码 agent 完成实现后，独立审计代码是否对齐 PRD 需求或原始 prompt 意图、代码质量是否达标、下一轮迭代的优化方向。

**evaluatorX 是纯分析器**：读取文档和代码，输出结构化评估结果。不写任何文档，文档更新由 orchestratorX 负责。

## 两种模式

| 模式 | 触发条件 | 输入 |
|------|---------|------|
| PRD-Based | 存在 Hybrid 文档 | 需求列表 + 验收标准 + 代码变更 |
| Prompt-Based | 无 Hybrid 文档 | 用户原始 prompt + 代码变更 |

## 审计流程

1. **加载规格文档**：读取 Parent + Child Hybrid 路径，提取需求、AC、文件索引、知识图谱
2. **获取代码变更**：读取 coderX 的 Change Summary Payload + git diff
3. **逐项审计**：对每个 AC 检查代码实现是否满足
4. **输出评估结果**：结构化 Evaluation Result Payload，包含 PASS/FAIL 判定和修复建议

## 触发条件

当用户或上游 agent 请求「审计代码」、「评估实现」、「运行 evaluator」、「review」时激活。
