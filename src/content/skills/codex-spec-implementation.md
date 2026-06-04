---
title: "Codex Spec Implementation"
description: "规格驱动的编码工作流——先读规格和验收标准，再读工程索引和知识图谱，最后提交可验证的代码变更。"
skillDir: "codex-spec-implementation"
tags: ["spec-driven", "workflow", "coder-agent"]
---

## 简介

coderX 的规格驱动实现 skill。按照统一流程执行开发：先读规格 → 读工程索引 → 读审计报告 → 提交可验证代码。

## 执行流程

### Step 1: 需求对齐

- 读取 Hybrid Tree 的 Section 7 获取分支级验收标准
- 读取 Parent 的 Section 0-6 获取共享的 NFR/DoD/Scope
- 形成当前轮次任务列表，避免超出范围

### Step 2: 上下文加载

- 读取 Section 8.1 主索引确认核心文件和入口点
- 读取 Section 8.2 知识图谱大纲
- 调用 MCP 精准检索当前模块的代码逻辑关系
- 读取 Section 8.3 增量索引差异

### Step 3: 审计反馈处理

- 读取 evaluatorX 的评估结果
- 按优先级处理修复项
- 标记变更摘要供 orchestratorX 决策

### Step 4: 实现与验证

- 执行代码变更
- 运行测试确保通过
- 生成变更摘要 Payload
