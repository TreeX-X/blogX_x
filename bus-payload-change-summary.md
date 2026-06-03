### Bus Payload: Change Summary
- **Changed Files**:
  - scripts/fetch-articles.mjs — Removed duplicated translation logic (constants and functions) and replaced with import reference to ../src/lib/article-translation.service.ts
  - src/lib/article-translation.service.ts — Added comment explaining why English is default for unknown language (because most technical content originates in English and English processing is safer)
- **Affected ACs (claimed)**:
  - Translation service handles edge cases (unknown language, mixed content, etc.) gracefully — [change reason: added clarification for unknown language fallback logic]
  - Code quality and maintainability — [change reason: removed duplicated translation logic to follow DRY principle]
- **Directed Audit Points**: [prompt evaluatorX to focus on verifying that the imported translation logic functions correctly and that the language fallback comment is appropriate]