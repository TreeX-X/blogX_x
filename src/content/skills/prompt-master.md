---
title: "Prompt Master"
description: "为 AI 工具生成优化提示词，支持 LLM / Cursor / Midjourney 等多工具，输出可直接粘贴的生产级 prompt。"
skillDir: "prompt-master"
tags: ["prompt-engineering", "ai-tools", "optimization"]
version: "1.6.0"
author: "TreeX"
---

## 简介

Prompt Master 是一个提示词工程 skill，当用户明确要求为特定 AI 工具编写、修改、改进或适配 prompt 时激活。自动识别目标工具，提取意图，输出单一生产级 prompt。

## 工作流程

1. **意图提取**：从用户输入中提取 9 个维度（任务、目标工具、输出格式、约束、输入、上下文、受众、成功标准、示例）
2. **工具路由**：根据目标工具选择最优 prompt 策略
3. **生成输出**：输出可直接粘贴的 prompt 块

## 硬规则

- 未确认目标工具前不输出 prompt
- 优先使用简单技术（角色分配、Few-shot、CoT），避免复杂框架
- 对推理原生模型（o3、DeepSeek-R1）不加 CoT
- 最多问 3 个澄清问题

## 输出格式

```
[可直接复制粘贴的 prompt]

🎯 Target: [工具名]
💡 [一句话说明优化了什么、为什么]
```
