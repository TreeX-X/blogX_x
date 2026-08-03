# BlogX_x Engineering Wiki

> **Purpose**: AI-first engineering context. Compact, multi-file, task-scoped.
> **Audience**: Agents and humans onboarding to this repo.
> **Not** the site content wiki (`src/content/wiki/**`).

## How to use (agents)

1. Read **this file** first.
2. Open **only** the pages relevant to the task (table below).
3. Inspect the linked source files in those pages.
4. Make the **smallest** change that satisfies the request.
5. Validate only the touched slice.

## Page map

| File | When to read |
|------|----------------|
| [01-identity.md](./01-identity.md) | Project identity, philosophy, design direction |
| [02-architecture.md](./02-architecture.md) | Stack, runtime, deploy, major subsystems |
| [03-routes.md](./03-routes.md) | Public routes, admin routes, API surface |
| [04-content-model.md](./04-content-model.md) | Content collections, schemas, helpers |
| [05-ai-search-graph.md](./05-ai-search-graph.md) | LanceDB, AI search, knowledge graph |
| [06-interactive-admin.md](./06-interactive-admin.md) | Messages, ideas, Redis/KV, admin auth |
| [07-pipeline-mcp.md](./07-pipeline-mcp.md) | Obsidian sync, build scripts, MCP, CI |
| [08-constraints.md](./08-constraints.md) | Engineering constraints & style rules |
| [09-agent-workflow.md](./09-agent-workflow.md) | Task → files map, prompt template |

## One-line identity

**BlogX_x** = personal digital garden (Astro 6 + React 19 + TS + Tailwind 4): posts, knowledge base, AI search, knowledge graph, Obsidian sync, MCP, interactive about modules, admin, toolbox/skills/repos/projects.

## Suggested starter prompt

```text
Read wiki/README.md first, then only the wiki pages relevant to [task].
BlogX_x is an Astro personal digital garden with content collections,
AI search (LanceDB + GLM), knowledge graph, Obsidian sync, MCP, and
Redis-backed interactive modules. Keep changes minimal; validate only
the touched slice.
```

## Related (not wiki)

| Path | Role |
|------|------|
| `CLAUDE.md` / `AGENTS.md` | WorkflowX agent routing (Claude / Codex) |
| `AUTOMATION.md` | Git hooks + vector sync CI |
| `docs/*` | Historical PRDs / design notes (product history) |
| `src/content/wiki/**` | **Published** wiki content on the site |
