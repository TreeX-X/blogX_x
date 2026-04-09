---
title: 用 Astro 做一套极简个人博客
date: 2026-04-06
description: 从路由到内容集合，30 分钟搭一套可持续写作的博客骨架。
tags:
  - astro
  - blog
isDraft: false
---

这篇文章记录 BlogX_x 的第一版实现思路：先把内容系统跑通，再做视觉细化。

## 核心约束

1. 页面路由清晰
2. 内容结构有类型约束
3. 阅读体验优先

```ts
export function sortByDateDesc<T extends { date: Date }>(items: T[]) {
  return [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
}
```

后续会继续补充标签系统和搜索能力。
