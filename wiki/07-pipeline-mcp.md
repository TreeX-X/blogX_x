# 07 — Pipeline, Automation & MCP

## Obsidian → knowledge base

| Item | Detail |
|------|--------|
| Script | `scripts/sync-obsidian-kb.mjs` |
| npm | `sync-kb`, `sync-kb:stage`, `sync-kb:check` |
| Target | `src/content/knowledge-base` (override via `LOCAL_KB_CONTENT_DIR`) |
| Source | `OBSIDIAN_KB_PATH` |

### Local git hooks (`AUTOMATION.md`)

1. **pre-commit**: `npm run sync-kb:stage` — sync + stage KB files  
2. **pre-push**: `npm run sync-kb` — abort if KB out of sync  
3. Hook install: `prepare` → `scripts/setup-git-hooks.mjs`

## Vector index

| Item | Detail |
|------|--------|
| Script | `scripts/init-db.mjs` |
| npm | `init-db` (also part of `build`) |
| Helpers | `scripts/check-lancedb.mjs`, `scripts/test-knowledge-graph.mjs` |

### Remote CI

`.github/workflows/vector-sync.yml` runs `npm run init-db` when these change:

- `src/content/posts/**`
- `src/content/knowledge-base/**`
- `scripts/init-db.mjs`
- `package.json` / lockfile
- the workflow file itself

Env for cloud index: `LANCEDB_URI`, `LANCEDB_API_KEY`, `SF_TOKEN`, etc.

## Article fetch / translate

| Script | Role |
|--------|------|
| `scripts/fetch-articles.mjs` | Pull external posts by `sourceUrl` |
| `src/lib/article-translation.service.*` | Translation path |
| `src/lib/article-db.ts` | Article DB helpers |

Used in `build` with `--translate`.

## Skills packaging

- `scripts/pack-skills.mjs` on `prebuild`
- Output under `public/skills-download/`
- Skill metadata in `src/content/skills`

## MCP (knowledge base)

| Mode | Command | Notes |
|------|---------|--------|
| stdio | `npm run mcp:kb` → `scripts/kb-mcp-server.mjs` | tools + resources |
| HTTP | `npm run mcp:kb:http` → `scripts/kb-mcp-http-server.mjs` | default `http://127.0.0.1:8787/mcp` |

### Tools

- `search_knowledge_base`
- `read_knowledge_base_entry`
- `list_knowledge_base_entries`

### Resources

- `kb://knowledge-base/...`
- `kb://wiki/...`

Longer notes: `docs/mcp-knowledge-base.md`. Project MCP config may also live in `.mcp.json`.

## Maintenance

- `scripts/maintenance.mjs` — `status` / `fix` / `verify`
- `scripts/lib/logger.mjs` — shared logging

## Env cheat sheet

| Var | Used for |
|-----|----------|
| `OBSIDIAN_KB_PATH` | Local vault path |
| `LOCAL_KB_CONTENT_DIR` | Sync target |
| `LANCEDB_*` | Vector DB |
| `SF_TOKEN` / embedding-related | Indexing |
| GLM / AI keys | Search answers |
| Vercel KV / Redis | Messages & ideas |
