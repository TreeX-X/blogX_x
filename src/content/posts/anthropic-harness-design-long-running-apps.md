---
sourceUrl: >-
  https://www.anthropic.com/engineering/harness-design-long-running-apps
title: 'Harness Design for Long-Running Application Development'
date: 2026-03-24T00:00:00.000Z
description: >-
  Anthropic 分享了如何通过 Harness 设计提升 Claude 在前端设计和长程自主编码中的表现——从 GAN 启发的 Generator-Evaluator 架构，到三 Agent 系统（Planner、Generator、Evaluator），实现多小时自主构建完整应用。
tags:
  - ai
  - agent
  - anthropic
  - claude
  - harness
  - long-running
originalAuthor: Prithvi Rajasekaran
originalLang: en
isDraft: false
---

Anthropic 工程团队分享了在长程自主编码 Agent Harness 设计方面的深度实践。核心思路借鉴了 GAN（生成对抗网络）的架构，通过分离生成与评估来突破单 Agent 的性能天花板。

## 为什么朴素实现不够好

在长程任务中，单 Agent 会遇到两个关键问题：

**上下文退化**：随着上下文窗口填满，模型会失去连贯性。部分模型还会出现"上下文焦虑"——在接近其认为的上下文限制时过早收尾工作。Compaction（压缩历史）虽然保持连续性，但无法给 Agent 一个全新的开始；而 Context Reset（上下文重置）配合结构化的交接文档则能有效解决这个问题。

**自我评估失真**：当被要求评估自己的工作时，Agent 倾向于自信地赞美产出——即使人类观察者明显觉得质量平庸。对于设计这类主观任务，这个问题尤其严重。将执行 Agent 和评估 Agent 分离后，单独调优一个持怀疑态度的评估器，远比让生成器自我批评更可行。

## 前端设计：让主观质量变得可评分

作者设计了四个评分维度：

- **Design Quality**：设计是否作为一个连贯整体而非零件集合？颜色、排版、布局等是否共同营造出独特的氛围和身份感
- **Originality**：是否有自定义决策的证据，还是模板布局、库默认值和 AI 生成模式？未修改的模板组件或典型 AI 生成痕迹（如紫色渐变白色卡片）会扣分
- **Craft**：技术执行——字体层级、间距一致性、颜色和谐度、对比度
- **Functionality**：独立于美学的可用性——用户能否理解界面功能、找到主要操作

作者强调 Design Quality 和 Originality 重于 Craft 和 Functionality，因为 Claude 在技术执行上已经表现不错，但在设计独特性上往往产出平庸。

评估器使用 Playwright MCP 直接与实时页面交互后打分，每轮运行 5-15 次迭代，完整运行可达 4 小时。在荷兰艺术博物馆网站的案例中，第 10 轮迭代时模型彻底抛弃了原有方案，将网站重新想象为一个 3D 空间体验——CSS 透视渲染的棋盘地板、自由悬挂的艺术品、门廊式导航。

## 扩展到全栈编码

作者将 GAN 模式扩展为三 Agent 系统：

### Planner Agent

接收 1-4 句话的简单提示，扩展为完整产品规格。被要求对范围保持雄心，聚焦产品上下文和高层技术设计，而非详细技术实现——避免规格中的错误级联到下游实现。

### Generator Agent

按 Sprint 工作，每次从规格中挑选一个功能。使用 React、Vite、FastAPI、SQLite 技术栈，在每个 Sprint 结束时自评后交给 QA。每个 Sprint 前，Generator 和 Evaluator 会协商 Sprint Contract——明确"完成"的定义。

### Evaluator Agent

使用 Playwright MCP 像用户一样点击运行中的应用，测试 UI 功能、API 端点和数据库状态。每个标准都有硬阈值，低于任何一个则 Sprint 失败。

**实际效果对比**（2D 复古游戏制作器）：

| 指标 | Solo | Full Harness |
|------|------|-------------|
| 时长 | 20 分钟 | 6 小时 |
| 成本 | $9 | $200 |
| 核心功能 | 游戏无法运行 | 可实际游玩 |

Solo 产出的游戏实体无法响应输入，实体定义和游戏运行时之间的连接断裂。Harness 产出则具备完整的精灵编辑器、关卡编辑器、内置 AI 生成功能，且游戏可以实际游玩。

## 持续简化

随着 Opus 4.6 发布，模型能力提升使得部分 Harness 复杂度可以降低：

- **移除 Sprint 结构**：Opus 4.6 能原生处理无需分解的工作
- **评估器改为单次终评**：对于模型能力范围内的任务，评估器变成不必要的开销；但对于仍处于能力边界的工作，评估器仍然带来实际提升
- **评估器的价值取决于任务与模型能力边界的距离**

更新后的 Harness 测试（浏览器 DAW 音乐制作器）：约 4 小时，$124 token 成本。Generator 连续运行超 2 小时无需 Sprint 分解，QA 仍然捕获了真实的 gaps——"多个核心 DAW 功能仅是展示性的，没有交互深度：片段无法在时间线上拖动，没有乐器 UI 面板，没有可视化效果编辑器"。

## 核心启示

> "有趣的 Harness 组合空间不会随着模型改进而缩小，而是会移动。AI 工程师的有趣工作在于不断发现下一个新颖组合。"

这篇文章展示了 Agent Harness 设计的核心原则：分离生成与评估、结构化上下文交接、根据模型能力动态调整架构复杂度。对于构建长时间运行的 AI Agent 系统的开发者来说，这些模式具有很强的参考价值。
