---
title: "Abstracter Code Summary"
description: "代码与工程分析 skill，快速理解结构、核心逻辑、模块关系，输出结构化 Markdown 分析报告。"
skillDir: "abstracter-code-summary"
tags: ["code-analysis", "engineering", "documentation"]
---

## 简介

Abstracter 是一个代码分析 skill，用于总结代码、分析项目结构、审查模块或子系统、生成结构化 Markdown 分析报告，或评估代码质量、风险和改进建议。

## 输入类型

- 单文件或多文件代码片段
- 指定目录/模块/子系统
- 完整工程仓库

## 分析维度

1. **工程结构**：语言、目录结构、入口点、核心依赖、运行方式
2. **核心逻辑**：模块职责、关键函数/类、调用关系、数据流
3. **质量视角**：异常处理、边界条件、潜在风险、技术债、可优化点
4. **结论输出**：总结、优先级建议、下一步行动项

## 输出模板

```markdown
# Overview
- Project Goal / Tech Stack / Scope

## Engineering Structure & Module Responsibilities
| Module | Responsibility | Key Files |

## Core Implementation & Workflow

## Key Code Interpretation

## Risks & Issues
| Risk | Impact | Evidence | Priority |

## Recommendations
```
