---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/test/tui/access.test.ts
supersedes: none
---

**What.** The busy line of 10.2 replaces the pane's last row with a marker and the command running, the marker four ASCII frames (- \ | /) at 120 ms, or the static ellipsis of the glyph set under reduced motion; it is the App's own, not pi-tui's Loader.

**Why.** pi-tui's Loader runs its own interval, which a test cannot hold; ASCII frames render in every terminal, conhost included.

**Result.** Tests drive the frames and the pause by hand: no frame before 300 ms, four frames in order, none and no interval under reduced motion, nothing left after the call.

**Consequence.** The pane's bottom border is hidden while a call runs past 300 ms.
