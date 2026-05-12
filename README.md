<div align="center">

# 🌲 BlogX_x: AI 驱动的个人数字花园

**一个完全由 AI Vibe Coding 构建的极简黑白博客系统，集知识库、语义搜索与知识图谱于一体。**

> 没有一行代码是手动从零编写的。整个项目从架构设计到功能实现，全程由 AI 多智能体工作流完成。

[![License](https://img.shields.io/badge/License-MIT-3B82F6?style=for-the-badge)](./LICENSE)
[![Astro](https://img.shields.io/badge/Astro_6-FF5D01?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![LanceDB](https://img.shields.io/badge/LanceDB-Vector_DB-8B5CF6?style=for-the-badge)](https://lancedb.com)
[![Vibe](https://img.shields.io/badge/Vibe_Coding-100%25-F59E0B?style=for-the-badge)](#-vibe-coding)

![Astro](https://img.shields.io/badge/Astro-Framework-FF5D01?style=flat-square&logo=astro&logoColor=white)
![LanceDB](https://img.shields.io/badge/LanceDB-向量数据库-8B5CF6?style=flat-square&logo=data&logoColor=white)
![GLM](https://img.shields.io/badge/GLM-AI_Search-10B981?style=flat-square&logo=openai&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deploy-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## 🌟 项目定位

**BlogX_x** 不只是一个博客。它是一扇门——通向你自己的知识体系。

它同时扮演两个角色：

- 📝 **个人博客**：发布长篇技术文章，记录设计思考与工程实践
- 📚 **本地知识库载体**：自动同步 Obsidian 笔记，构建可检索、可关联的知识网络

两者共享同一套 **AI 语义搜索引擎** 和 **向量数据库**，你的每一篇笔记、每一篇文章都会被 AI 理解、关联、可视化。

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🤖 **AI 对话式搜索** | 基于 GLM 大模型 + LanceDB 向量检索，输入自然语言即可获得 AI 回答与相关卡片 |
| 🕸 **知识图谱可视化** | 基于向量相似度自动构建内容关系网络，点击节点跳转原文 |
| 🔄 **Obsidian 自动同步** | 增量同步本地 Obsidian 笔记，自动转换 Wikilinks / Callouts 等语法 |
| 🔌 **MCP 协议接入** | 通过 Model Context Protocol 让 AI 助手直接访问你的知识库 |
| 🌗 **极简黑白美学** | 深色/浅色自适应，编辑器风格排版，零装饰零干扰 |
| 📱 **多端响应式** | 从 375px 手机到 2560px 4K 显示器，全分辨率自适应布局 |

## 🏗 技术架构

```
┌─────────────────────────────────────────────────┐
│                   用户浏览器                      │
├─────────────┬──────────────┬────────────────────┤
│   博客文章   │   知识库条目  │  知识图谱可视化     │
│  (Markdown)  │ (Obsidian→)  │ (react-force-graph) │
├─────────────┴──────────────┴────────────────────┤
│              Astro 6 + React 19 + Tailwind 4     │
├─────────────────────────────────────────────────┤
│  API Layer: AI Search / Vector Search / Graph    │
├─────────────────────────────────────────────────┤
│  LanceDB (向量数据库) + GLM-4.5-AIR (大语言模型)  │
├─────────────────────────────────────────────────┤
│  SiliconFlow BGE-M3 Embeddings (1024维向量)      │
└─────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 框架 | Astro 6 + React 19 | SSG/SSR 混合渲染，组件级交互 |
| 样式 | Tailwind CSS 4 | 原子化样式 + 自定义主题变量 |
| 向量数据库 | LanceDB | 语义向量存储与相似度检索 |
| AI 模型 | GLM-4.5-AIR | 对话式搜索回答生成 |
| 嵌入模型 | SiliconFlow BGE-M3 | 1024 维语义向量编码 |
| 同步脚本 | Node.js | Obsidian → 知识库增量同步 |
| 协议 | MCP (stdio/HTTP) | AI 助手知识库接入 |
| 部署 | Vercel (SSR) | 边缘函数 + 静态资源 |

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env  # 编辑填入 API Key

# 3. 初始化向量数据库
npm run init-db

# 4. 同步 Obsidian 知识库
npm run sync-kb

# 5. 启动开发服务器
npm run dev
```

### 环境变量

```env
# LanceDB 云端
LANCEDB_URI="db://your-db-uri"
LANCEDB_API_KEY="your-api-key"

# SiliconFlow 向量嵌入
SF_TOKEN="your-siliconflow-token"

# GLM AI 搜索
GLM_API_KEY="your-glm-api-key"
GLM_MODEL="glm-4.5-air"

# Obsidian 知识库路径
OBSIDIAN_KB_PATH="path/to/your/obsidian/vault"
```

## 📂 项目结构

```
blogX_x/
├── src/
│   ├── pages/                    # 页面路由
│   │   ├── index.astro           # 首页 (AI 搜索 + 知识图谱)
│   │   ├── about.astro           # 关于页
│   │   ├── posts/                # 博客文章
│   │   ├── knowledge-base/       # 知识库
│   │   ├── toolbox/              # 工具箱
│   │   └── api/                  # API 端点
│   │       ├── ai-search.ts      #   AI 增强搜索
│   │       ├── search.ts         #   向量相似度搜索
│   │       └── knowledge-graph.ts#   知识图谱数据
│   ├── components/               # React 组件
│   ├── content/                  # 内容集合 (Markdown)
│   ├── lib/                      # 工具函数
│   ├── layouts/                  # 布局模板
│   └── styles/                   # 全局样式
├── scripts/
│   ├── init-db.mjs               # LanceDB 向量索引初始化
│   ├── sync-obsidian-kb.mjs      # Obsidian 笔记同步
│   ├── kb-mcp-server.mjs         # MCP 服务 (stdio)
│   └── kb-mcp-http-server.mjs    # MCP 服务 (HTTP)
└── public/                       # 静态资源
```

## 🎯 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 首页：AI 搜索、最新文章、最新知识库、知识图谱 |
| `/posts` | 博客文章列表 |
| `/posts/[slug]` | 文章详情 + TOC 目录 |
| `/knowledge-base` | 知识库目录 + 分类侧栏导航 |
| `/knowledge-base/[...slug]` | 知识库条目详情（支持嵌套路径） |
| `/toolbox` | 工具箱 |
| `/about` | 关于页 |

## 📡 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/ai-search` | GET/POST | AI 对话式搜索，返回回答 + 相关卡片 |
| `/api/search` | GET/POST | 纯向量相似度搜索 |
| `/api/knowledge-graph` | GET | 知识图谱节点与边数据 |

## 🔍 AI 搜索工作流

```
用户输入自然语言问题
        ↓
SiliconFlow BGE-M3 编码为 1024 维向量
        ↓
LanceDB 向量相似度检索 Top-K 条目
        ↓
结合关键词匹配精排
        ↓
GLM-4.5-AIR 基于检索结果生成对话式回答
        ↓
返回：AI 回答 + 相关内容卡片列表
```

## 🔄 Obsidian 同步

`sync-obsidian-kb.mjs` 脚本特性：

- 自动发现 Obsidian vault 中的 Markdown 文件
- 转换 Obsidian 特有语法（Wikilinks、Callouts、注释）
- 基于 content hash 增量同步，不重复处理
- 支持嵌套目录结构
- 自动添加 `source: obsidian:` 元数据

## 🔌 MCP 服务

通过 Model Context Protocol 让 AI 助手直接访问知识库：

```bash
# stdio 模式（Claude Desktop 等）
npm run mcp:kb

# HTTP 模式（远程访问）
npm run mcp:kb:http
```

支持能力：搜索 · 读取 · 列表

## 📝 内容格式

### 博客文章 (`src/content/posts/*.md`)

```yaml
---
title: 文章标题
date: 2026-04-23
description: 文章描述
tags: [tag1, tag2]
isDraft: false
---

文章内容...
```

### 知识库条目 (`src/content/knowledge-base/**/*.md`)

```yaml
---
title: 条目标题 (可选)
date: 2026-04-23 (可选)
description: 描述 (可选)
tags: [tag1, tag2] (可选)
isDraft: false
source: obsidian:path (自动添加)
---

笔记内容...
```

## 💎 Vibe Coding

> **这个项目没有传统意义上的"手写代码"。**

从项目架构、样式设计、API 实现到知识图谱可视化——全部由 AI 多智能体工作流 **Vibe** 出来：

- **PlannerX** 负责需求分析与架构设计
- **CoderX** 负责功能实现与代码生成
- **EvaluatorX** 负责质量审核与迭代优化
- **OrchestratorX** 负责全局调度与状态流转

每一次功能迭代都经过 **规划 → 实现 → 审核** 的完整闭环，通过混合文档（Hybrid Docs）在智能体之间传递纯净上下文，确保每一行代码都经过严格校验。

> 💡 这不仅是一个博客——它是 AI 驱动开发的最佳实践证明。

## 📋 NPM 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建结果 |
| `npm run sync-kb` | 同步 Obsidian 知识库 |
| `npm run sync-kb:stage` | 同步并暂存变更 |
| `npm run init-db` | 初始化/更新向量索引 |
| `npm run mcp:kb` | 启动 MCP 服务 |
| `npm run mcp:kb:http` | 启动 MCP HTTP 服务 |

## 🌍 部署

项目已配置 Vercel 适配器，支持 SSR：

```bash
npm run build      # 构建到 .vercel/output/
npm run preview    # 本地预览构建结果
```

## 🌟 关于

**BlogX_x** 是一个 Vibe Coding 实验项目，探索 AI 全栈开发的边界。

当 AI 成为你的首席工程师，代码只是副产品——真正的价值在于 **架构思维** 和 **知识体系的构建**。

如果这个项目给了你启发，欢迎点亮 ⭐，让更多人看到 AI 开发的未来。

---

<div align="center">

[MIT License](./LICENSE) · 自由使用 / 修改 / 再分发

Made with 🤖 by [@TreeX-X](https://github.com/TreeX-X)

</div>