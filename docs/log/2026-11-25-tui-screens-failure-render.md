---
date: 2026-11-25
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/design/screens/simulate.png
  - packages/cli/scripts/tui-screens.ts
supersedes: none
---

**What.** In the first PNGs the box drawing had gaps between rows, and Simulate's bars, drawn with the full block, came out as broken glyphs. Separately, the worktree could not run the script until `pnpm install --frozen-lockfile --offline` linked @engram/view.

**Why.** A line height of 1.25 leaves space between box glyphs, and the browser font draws the full block with gaps around it.

**Result.** The page now uses the font's own line height, and each run of full blocks is drawn as a filled cell in its colour. The PNGs were checked by eye: Home, Read, write deny (light), Help, Simulate, the actor switcher and line mode.

**Consequence.** None for the `.ansi` files, which keep the block character itself.
