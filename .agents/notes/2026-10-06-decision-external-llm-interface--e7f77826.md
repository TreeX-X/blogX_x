---
schema: harness-note/1
id: e7f77826-07b1-4f31-968b-7d2b07a1dbc4
kind: decision
lifecycle: implemented
created: 2026-10-06
class: architecture
---

# 决策：外部 LLM 接口统一为 OpenAI 兼容命名与单一配置出口

## Context

仓库原先以 GLM（智谱）为默认实现：`GLM_API_KEY`/`GLM_MODEL` 两个环境变量、默认值 `glm-4.5-air`、硬编码端点 `https://open.bigmodel.cn/api/paas/v4`。它渗透在四处消费方——`src/lib/article-translation.service.mjs`（翻译）、`src/lib/article-intake.service.ts`（frontmatter 提取）、`src/lib/kv-messages.ts`（留言 AI 审核）、`src/pages/api/ai-search.ts`（AI 搜索回答）。

代码的请求形态其实早已是 OpenAI 兼容（`<baseUrl>/chat/completions` + `Authorization: Bearer` + `messages` 载荷），智谱的端点本身即 OpenAI 兼容，所以缺的不是协议适配而是命名与配置的固化。三处各自读 env、各自兜底供应商默认值，其中 `kv-messages.ts` 与 `ai-search.ts` 连 `GLM_BASE_URL` 都不读、URL 硬编码。换一个提供商必须改四处代码。

## Decision

环境变量统一为 `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`，不含任何供应商名。配置读取收敛到唯一出口 `getLlmConfig()`，定义在 `src/lib/article-translation.service.mjs`（它已是全仓唯一翻译实现），其余三处 import 它。`article-intake.service.ts` 内原有的第二份 `glmConfig()` 删除——那份重复还带着"改端点时两边一起改"的注释，是双源。

三项一律从 env 读、**不内置供应商默认值**，缺任何一项即抛错并列出缺哪几项。请求继续走 `<LLM_BASE_URL>/chat/completions`，任何 OpenAI 兼容端点均可接入。

`translateText` 在配置缺失时退回占位译文（`[中文翻译]`/`[English Translation]` 前缀）。这条路径不是噪音：intake 侧靠占位标记与"译文与原文逐字相同"判定"这次没真译"，使失败随草稿可见。配置缺失因此表现为"可见的失败"而非抛错穿透。

## Alternatives considered

保留 `GLM_*` 命名、只把 URL 改成可配置：最小 diff，但命名继续绑定单一供应商，后来者读代码会以为只能接智谱；环境变量也仍与接口语义不符。

设置供应商默认值（如默认指向智谱、允许 env 覆盖）：对新机器更友好，但换提供商时表现为一次难以定位的静默失败——请求发往旧端点、报错信息却不指向配置。缺失即报错只费一次配置。

提供统一封装层 / 引入厂商 SDK：过度设计。OpenAI 兼容已是事实标准，一个 `getLlmConfig()` 加四处 import 已足够，引入抽象层的维护成本高于收益。

## Consequences

换外部 LLM 只改 `.env` 三行，不动代码；`kv-messages.ts` 与 `ai-search.ts` 的硬编码 URL 随之消失，这是本次最实质的耦合解除。新增 `.env.example`（`.gitignore` 早有 `!.env.example` 例外但从未有该文件），把内容真源、向量模型、LLM、Redis、面板、Deploy Hook 六类配置一次性模板化，新机器不再靠口口相传。

代价是三项全必填：本地 `.env` 已补 `LLM_BASE_URL` 与 `LLM_MODEL`（原只有 key 与 model），漏配时翻译、审核、AI 搜索同时不可用，但报错会直接点名缺哪项。智谱作为当前 provider 仍是可用选项，只是不再是代码里的默认假设。

## Revisit signals

需要接入非 OpenAI 兼容的接口（如 Anthropic Messages、Gemini generateContent）时，`getLlmConfig()` 应扩展为按 provider 分派的适配层，而不是在四处调用点各写一套。出现第二个 provider 长期并存时同理。
