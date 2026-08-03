# 01 — Project Identity

## Snapshot

| Field | Value |
|-------|--------|
| Project | BlogX_x |
| Type | Personal digital garden / blog / knowledge base |
| Stack | Astro 6 + React 19 + TypeScript + Tailwind CSS 4 |
| Primary language | Chinese (UI + most content) |
| Deploy | Vercel (`@astrojs/vercel`, `output: "server"`) |
| Node | `>= 22.12.0` |

## Philosophy

- Content-first, light interaction, low maintenance
- Prefer local scripts + content collections over a heavy custom backend
- AI is a **retrieval + answer** layer on top of owned markdown, not the source of truth

## Design direction (current)

- Theme: **warm paper + oxblood red** (ref. ljj.world), light-only
- Blueprint grid background, glass panels, small radii (4–8px)
- Pixel-wave brand title on home (`PixelWaveTitle`)
- Strong typography, low distraction reading
- Knowledge graph: desktop-only; hidden on mobile

Tokens live in `src/styles/global.css` (`--bg`, `--accent`, etc.).

## What the product does

1. Publish **curated/translated posts** (`src/content/posts`)
2. Publish **local knowledge base** synced from Obsidian (`src/content/knowledge-base`)
3. Optional site **wiki content** (`src/content/wiki`) — separate from this engineering wiki
4. Catalog **repos / skills / projects** content collections
5. **AI search** over LanceDB + GLM
6. **Knowledge graph** from vector similarity
7. **About** interactive modules (fun messages, idea box)
8. **Admin** moderation surfaces
9. **Toolbox** curated external tools
10. **MCP** access to knowledge-base / wiki content for agents

## Naming note

| Path | Meaning |
|------|---------|
| `/wiki` (this folder) | Engineering context for humans/agents |
| `src/content/wiki` | Runtime content collection rendered by the site |
| `/wiki/[...slug]` route | Site pages for the content collection |
