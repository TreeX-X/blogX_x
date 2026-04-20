# Automation Flow

## Local (before commit/push)

1. `pre-commit` hook:
   - Runs `npm run sync-kb:stage`
   - Syncs Obsidian markdown into `src/content/knowledge-base`
   - Automatically stages synced files

2. `pre-push` hook:
   - Runs `npm run sync-kb`
   - Verifies no uncommitted changes remain in `src/content/knowledge-base`
   - Aborts push if knowledge-base content is out of sync

## Remote (after push)

GitHub Actions workflow `.github/workflows/vector-sync.yml` runs when related files change:
- `src/content/posts/**`
- `src/content/knowledge-base/**`
- `scripts/init-db.mjs`
- `package.json`
- `package-lock.json`
- workflow file itself

Workflow runs `npm run init-db` to rebuild vector index and sync LanceDB Cloud.

## Environment Variables

- `OBSIDIAN_KB_PATH`: local Obsidian knowledge-base directory
- `LOCAL_KB_CONTENT_DIR`: target content directory in this repo
- `LANCEDB_URI`, `LANCEDB_API_KEY`, `SF_TOKEN`: cloud indexing dependencies
