---
{
  "schema": "harness-note/2",
  "id": "51a5959a-693e-43eb-a5a0-a228e5628e87",
  "kind": "note",
  "lifecycle": "accepted",
  "created": "2026-10-22",
  "updated": "2026-10-24T04:05:00Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# Project Identity

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

- Theme: **warm paper industrial illustration**, brown ink + oxblood red, light-only
- Continuous paper background, fine ink boundaries and small corners; no blueprint grid or glass styling
- 3D server case sits on the shared page with transparent canvas and a soft contact shadow; no floating drafting marks
- Pixel-wave brand title on home (`PixelWaveTitle`)
- Icon: **墨印 (ink seal monogram)** — a rounded ink seal (R14) with the X cut in negative space (8.5 square-cap strokes); pure two-tone ink/paper, no accent red (the V-notch sprout of the initial draft was removed in the final). Source `public/favicon.svg`, with `favicon-32.png`, `favicon.ico` (16/32/48) and `apple-touch-icon.png` fallbacks plus `public/logo/treeXLogo.png` (1024 hi-res); the SVG favicon adapts to browser dark mode while the site itself stays light-only (2026-10-24). Design spec incl. clear space X/4 and mono/reversed plates: `_temp/logo-redesign/logo-design-board.html` (scratch). Direction record: [icon decision](2026-10-24-decision-icon-sprout-seal--16f10e25.md)
- Reading pages share the left chapter rail (`ReadingRail`): posts, knowledge base and site wiki
- Strong typography, low distraction reading
- Knowledge graph: desktop-only; hidden on mobile

Tokens live in `src/styles/global.css` (`--bg`, `--accent`, etc.); shared component finishing in `src/styles/paper-ui.css`. Direction: [warm-paper-illustration](warm-paper-illustration.md). Server case shape: [server requirement](2026-10-15-server-tab-linecase-requirement--103be143.md).

## What the product does

1. Publish **curated/translated posts** (`src/content/posts`)
2. Publish **knowledge base** notes (`src/content/knowledge-base`) — LanceDB `content` is the truth source; Obsidian vault is an optional per-item import source
3. Optional site **wiki content** (`src/content/wiki`) — a site content collection, unrelated to the engineering Notes
4. Catalog **repos / skills / projects** content collections
5. **AI search** over LanceDB + an external LLM
6. **Knowledge graph** from vector similarity
7. **About** interactive modules (fun messages, idea box)
8. **Admin** moderation surfaces
9. **Toolbox** curated external tools
10. **MCP** access to knowledge-base / wiki content for agents
11. **Server case** — independent `/server` page with a draggable 3D line illustration; home keeps its pixel title. See [server requirement](2026-10-15-server-tab-linecase-requirement--103be143.md).

## Naming note

| Path | Meaning |
|------|---------|
| `src/content/wiki` | Runtime content collection rendered by the site |
| `/wiki/[...slug]` route | Site pages for the content collection |
| `.agents/notes/` | Engineering Notes (this corpus) — replaced the repo-root `wiki/` engineering wiki, removed 2026-10-22 |

---
迁移自 `wiki/01-identity.md`（2026-10-22 工程 wiki 移除；原文经 git 历史可溯）。
