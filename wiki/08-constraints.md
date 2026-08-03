# 08 — Engineering Constraints

## Change policy

1. Prefer **minimal, local** changes over broad refactors.
2. Reuse existing route / content / API abstractions.
3. Avoid adding a new backend service unless unavoidable.
4. Validate only the **touched slice** (page, API, or script).
5. Keep agent-facing docs short and task-scoped (this wiki).

## UI / design

- Stay consistent with **warm paper + oxblood** tokens in `src/styles/global.css`.
- Do not reintroduce an ad-hoc dark theme unless product direction changes.
- Knowledge graph remains **desktop-only**.
- About page: light interaction only — no feature dumping.
- Typography and reading comfort beat decorative chrome.

## Content

- Public lists filter `isDraft === true`.
- Posts are **sourceUrl-centric** (external articles + optional translate pipeline).
- Knowledge base is **Obsidian-synced** — prefer fix sync script over hand-editing bulk mirrored trees when possible.
- Distinguish:
  - engineering wiki → repo root `wiki/`
  - site wiki content → `src/content/wiki/`

## AI / infra

- Rate-limit public AI and write endpoints.
- Do not commit secrets (`.env` stays local).
- LanceDB local vs cloud behavior must respect Vercel (`VERCEL=1`) and fallback flags.
- Rebuild vector index when content retrieval quality is the task (`init-db`), not by hardcoding results in UI.

## WorkflowX (agents)

- Main orchestration agent does **not** write application code directly when WorkflowX coding routes apply — dispatch `coderX` (see `CLAUDE.md` / `AGENTS.md`).
- Active `/x*` workflows: follow Hybrid Tree status in `.hybrid/status.json`.
- This engineering wiki is **read-first context**, not a substitute for reading the files you change.

## Docs hygiene

- Update the relevant `wiki/*.md` page when architecture or route maps change.
- Leave historical PRDs in `docs/` as archive; do not treat them as current schema truth without checking `src/content.config.ts` and code.
