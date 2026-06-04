---
title: "Orchestrator Playbook"
description: "orchestratorX 完整工作流手册——规划对话、Mode A/B/C 工作流、核心迭代循环、Hybrid Tree 路由、需求变更处理。"
skillDir: "orchestrator-playbook"
tags: ["orchestration", "workflow", "multi-agent"]
---

## 简介

orchestratorX 的完整工作流手册，包含主工作流逻辑和按需触发模块。支持三种模式（Whole/Local/Unit）的编排、多 agent 协调、迭代循环管理。

## 模块索引

| 模块 | 触发时机 |
|------|---------|
| 环境初始化 + MCP 降级 | 首次进入 xwhole/xlocal/xunit |
| Bus Payload 校验 | 跨 agent 交接（coderX ↔ evaluatorX） |
| 评估后文档更新 | evaluatorX 返回后 |
| Prompt 预处理 | 调用 coderX 前 |
| 并行设置 | `-parallel` 参数触发 |
| 任务协调 | 并行模式运行时 |

## 核心迭代循环

1. **规划对话**：与用户对齐需求，生成 Hybrid Tree（Parent + Children）
2. **Prompt 预处理**：调用 promptMasterX 优化执行指令
3. **编码分发**：调用 coderX 实现
4. **评估审查**：调用 evaluatorX 审计
5. **迭代修复**：根据评估结果循环（最多 N 轮）
6. **合并产出**：将 worktree 分支合并回主分支

## 支持参数

- `-N [number]`：最大评估迭代轮数
- `-box [name]`：沙箱分支隔离
- `-parallel`：Agent Teams 并行执行
- `-team [name]`：并行团队名称
