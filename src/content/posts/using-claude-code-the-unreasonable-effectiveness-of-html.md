---
sourceUrl: >-
  https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html
title: 'Using Claude Code: The Unreasonable Effectiveness of HTML'
date: 2026-05-21T00:00:00.000Z
description: 探索 Claude Code 中 HTML 的惊人有效性
tags:
  - claude
  - html
  - ai
originalAuthor: Anthropic
originalLang: en
isDraft: false
---
## 为什么使用 HTML？

与 Markdown 相比，HTML 有几个特点使其更适合我现在用 Claude Code 进行的工作，包括那些需要或涉及以下任务的工作：

## 信息密度

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a0cc2df7520821249c2495c_image10.png)

与 Markdown 相比，HTML 可以传达更丰富的信息。当然，它可以像标题和格式化这样的简单文档结构，但它也可以表示各种其他信息，例如：

- 使用表格表示表格数据
- 使用 CSS 设计数据
- 使用 SVG 进行插图设计
- 使用 script 标签创建代码片段
- 使用 HTML 元素结合 JavaScript 和 CSS 实现交互
- 使用 SVG 和 HTML 创建工作流程
- 使用绝对位置和画布处理空间数据
- 使用 image 标签显示图像

在我看来，几乎没有任何 Claude 能够阅读的信息集是你无法用 HTML 有效表示的。这使得模型能够向你传达深入信息，并让你高效地审查这些信息，成为一种非常高效的方式。

我发现，如果模型无法做到这一点，它在Markdown中可能会做些效率更低的事情，比如ASCII图表，或者我最喜欢的，用Unicode字符来估算颜色。

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a0cccd2c085977fc720eb4e_be6aa05f.png)

‍

## 视觉清晰度和易读性

‍

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a0cccd2c085977fc720eb48_343de6c4.png)

As Claude is capable of tackling more complex work, it's also able to write larger and larger specs and plans. I’ve found that I tend to not actually read more than a 100-line Markdown file, and I certainly am not able to get anyone else in my organization to read it.

But HTML documents are much easier to read because Claude can organize the structure visually to be ideal to navigate with tabs, illustrations, and links. It can even be mobile responsive so you can read it differently based on your form factor.

## Ease of sharing

Markdown files are fairly hard to share since most browsers do not render them natively well. You often have to add them as attachments to emails or messages.

只要您上传HTML 文件，就可以轻松分享链接。您的同事可以在他们希望的任何地方打开它，并轻松引用它。

如果您的规范、报告或PR说明以HTML格式呈现，那么有人实际阅读它的几率会高得多。

## 双向交互

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a0cccd2c085977fc720eb4b_438fa236.png)

‍

HTML 还可以让你 [与文档交互](https://x.com/trq212/status/2017024445244924382); 例如，你可能想要它添加滑块或旋钮来调整设计，或者允许你调整算法中的不同选项以查看结果。你也可以要求它让你将这些更改复制到提示中，然后粘贴回 Claude Code。

当有用时，这可以让你为正在处理的具体问题创建单独的编辑环境。

## 数据摄取

使用 Claude Code 而不是 Claude.ai 或 Claude Design 来制作 HTML 文件的最大原因之一是 Claude Code 可以摄取大量上下文信息。例如，在撰写本文时，我要求 Claude Code 遍历我的代码文件夹，找到我生成的所有 HTML 文件，对它们进行分组和分类，然后制作一个包含代表每种类型的图表的 HTML 文件。您在本文中看到的图表就是这一过程的直接结果。

除了文件系统外，Claude Code 还可以通过您的 MCP（如 Slack、Linear 等）、您的网络浏览器（在 Chrome 中使用 Claude）以及 您的 git 历史记录来查找额外的上下文信息。

## 入门指南

有一点值得注意：你不需要做太多工作就能让 Claude 生成这样的 HTML。你可以简单地提示它"*创建一个 HTML 文件*"或"*创建一个 HTML 工件*"。关键是知道你希望这个工件做什么以及如何使用它。随着时间的推移，围绕重复模式构建技能可能是合理的，但从头开始提示是了解它如何在不同用例中工作的好方法。

## 用例

为了使这种方法更加具体，下面是一些[示例用例](https://thariqs.github.io/html-effectiveness/)我认为 使用HTML文件比Markdown更有意义。您也可以通过这些用例的GitHub图库跟进，[这里](https://github.com/anthropics/html-effectiveness)。

### 规范、规划和探索

HTML（HyperText Markup Language）是一个丰富的画布，可以让 Claude 深入解决问题。当我开始处理一个问题时，而不是使用简单的 Markdown 计划，我期望创建一个由 HTML 文件组成的网络。例如，我可能会先要求 Claude Code 进行头脑风暴，创建一些不同选项的探索方案。然后我会要求它进一步扩展其中一个方案，可能制作一些类型界面的原型或示例。最后，当我感觉良好时，我会要求它编写一个实施计划。当我满意这个计划后，我会创建一个新会话，并将所有这些文件传递给它来实施。

在验证时，我也会要求验证代理读取这些文件，这样它就能对所需内容有更广泛的上下文理解。

‍

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a0cccd2c085977fc720eb5c_7eaa0090.png)

**示例提示词：**

- *我不确定入职引导屏幕应该采用什么方向。生成6种明显不同的方案——改变布局、语调和密度——并将它们以网格形式排列在一个HTML文件中，以便我能够并排比较它们。为每个方案标注其做出的权衡。*
- *在一个HTML文件中创建一个详细的实施计划，确保制作一些原型图，展示数据流，并添加我可能需要查看的重要代码片段。使其易于阅读和理解。*

**用于： **

- 探索在代码中实现其他方法
- 同时尝试多种视觉设计

### 代码审查与理解

在 Markdown 文件中阅读代码可能比较困难，但使用 HTML，我们可以渲染差异（diffs）、注释、流程图和模块。  使用 HTML 来理解代理编写的代码，审查代码，或向审查你代码的人解释 PR。

‍

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a0cccd2c085977fc720eb5f_ce1ada20.png)

**示例提示： **

*帮我创建一个描述此 PR 的 HTML 工件来进行审查。我对流式/背压（streaming/backpressure）逻辑不太熟悉，所以请重点关注这方面。使用内边距注释渲染实际的差异，按严重程度对发现进行颜色编码，以及任何其他可能有助于清晰传达概念的内容。*

**用途： **

- 创建 PR
- 审查 PR
- 理解代码中的主题

### 设计和原型

Claude Design 基于 HTML，因为 HTML** **在设计方面极具表现力，即使你的最终界面不是 HTML。Claude 可以用 HTML 勾勒出设计，然后用你选择的语言编写，无论是 React、Swift 等。

你还可以制作交互原型，如动画、操作等。可以考虑让 Claude 制作滑块、旋钮等，以精确调整你想要的效果。

‍

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a0cccd2c085977fc720eb51_2f351343.png)

**示例提示： **

我想原型设计一个新的结账按钮，点击时它会播放一个动画，然后迅速变成紫色。请创建一个HTML文件，其中包含多个滑块和选项，让我可以尝试此动画的不同选项，并给我一个复制按钮来复制效果良好的参数。

**用途：**

- 创建设计系统工件
- 调整组件
- 可视化组件库
- 原型设计  动画

### 报告、研究和学习

Claude Code 在整合多个数据源的信息并将其转换为易于阅读的报告方面非常有效。您可以提示 Claude 搜索您的 Slack、代码库、git 历史记录或互联网，并利用它来生成易于阅读的报告。

您可以将其组装成长篇 HTML 文档、交互式说明，甚至是幻灯片/演示文稿。请 Claude 使用 SVG 制作图表以帮助可视化。

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a0cccd2c085977fc720eb54_e0306f54.png)

**示例提示：**

*我不理解我们的速率限制器（rate limiter）实际是如何工作的。阅读相关代码并生成一个单一的HTML解释页面：一个令牌桶（token-bucket）流程图，3-4个关键代码片段的注释，以及底部的"陷阱"（gotchas）部分。针对只阅读一次的人进行优化。*

**用于：**

- 编写功能总结
- 生成解释性内容
- 起草每周状态报告
- 创建事件报告
- 制作SVG插图、流程图和技术图表,

### 自定义编辑界面

有时很难在文本框中纯粹地描述你想要的东西。对于这种用例，我常常会要求 Claude 为我正在处理的具体东西构建一个一次性编辑器： 不是产品，也不是可重用的工具，而是一个单一的 HTML 文件，专门为这一片数据而构建。

诀窍总是以导出结束：一个"复制为 JSON"或"复制为提示"按钮，将我在 UI 中所做的任何操作转换回可以粘贴到 Claude Code 或提交到文件的内容。你仍然在这个循环中，但循环变得更加紧密。

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a0cccd2c085977fc720eb57_0e3ace42.png)

**示例提示：**

- * 我需要重新排序这30个Linear工单。请为我创建一个HTML文件，将每个工单作为可拖动的卡片分布在"现在"/"下一步"/"稍后"/"删除"列中。请根据您的最佳猜测进行预排序。添加一个"复制为Markdown"按钮，导出最终排序结果，每个桶附带一行理由。*
- *这是我们功能标志的配置。请为其构建一个基于表单的编辑器， 按区域分组标志，显示它们之间的依赖关系，如果我启用了一个前提条件已关闭的标志，请警告我。添加一个"复制差异"按钮，只给我提供已更改的键。*

* 我正在调整这个系统提示。创建一个并排编辑器：左侧是可编辑的提示，变量槽位高亮显示，右侧是三个示例输入，实时渲染填充后的模板。添加一个字符/标记计数器和复制按钮。*

**用途：**

- 重新排序、分类或整理任何内容（工单、测试用例、反馈）
- 编辑结构化配置（功能标志、环境变量、带约束的 JSON/YAML）
- 调整提示、模板或文案，带实时预览
- 整理数据集 — 批准/拒绝行，标记示例，导出选择
- 为文档、转录内容或差异添加注释并导出这些注释
- 选择难以用文本表达的价值：颜色、缓动曲线、裁剪区域、cron计划、正则表达式

### 常见问题

以下是我关于在Claude Code中使用HTML时被问到最多的问题，以及我总结出的实用日常习惯：

**这样不会降低效率吗？**

虽然 Markdown 通常使用更少的 token，但我发现 HTML 的更强表现力以及我更可能阅读它的特性意味着我能获得更好的整体输出。在 Opus 4.7 的 1MM 上下文窗口中，增加的 token 使用在上下文窗口中并不明显。

**你现在什么时候使用 Markdown？**

坦白说，我已经几乎完全停止使用 Markdown，但我可能站在 HTML 极端主义者的那一端。

**这就是你替代规划的方式吗？**

我发现，与其制定单一的计划，我倾向于为计划的不同部分/阶段创建几个不同的HTML文件（HTML files）。例如，我可能会用HTML制定一个实施计划，然后创建另一个文件用于探索UI界面（UIs），最后再制作一个列出所有设计的HTML组件（HTML component）。我倾向于保留这些文件作为未来的参考，也用于验证用途。

## 与Claude保持同步

以上所有这些想说的是，我使用HTML而不是Markdown的真正原因是，它帮助我更好地与Claude保持同步。随着Claude承担更多任务，我注意到我不再那么仔细地阅读计划，我想要一种方式来参与它的选择，而不是简单地交出去。HTML恰好就是这样的方式。我现在比以往任何时候都更有参与感。"

开始使用 [Claude Code](https://code.claude.com/docs/en/quickstart).

*本文由技术团队成员Thariq Shihipar撰写，表达了他对使用HTML文件与Claude Code的个人观点和偏好*.

‍
