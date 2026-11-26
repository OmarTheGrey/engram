---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/theme.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: docs/log/2026-11-23-e8-15c-decision-ascii-fold.md
---

**What.** The ASCII glyphs: corners `+`, lines `-` and `|`, closed fold `~`, open fold `v`, allow `+`, deny `x`, ask `?`, warn `!`, skip `-`, running `*`, info `i`, block `#`, more `...`; the selection mark stays `>`, drawn by the screens.

**Why.** Verification N5: `+` for a closed fold was also allow's symbol and the corners'. `~` is no other glyph and not the mark; `>` for the fold would have needed a new mark in every screen, E8.15b's included.

**Result.** A flow test holds the closed fold apart from every other ASCII glyph and from `>`; the ASCII frames were regenerated.

**Consequence.** `docs/design/tui.md` 11.7 still lists `>` for the closed fold: the lead's to update.
