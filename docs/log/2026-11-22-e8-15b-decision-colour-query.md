---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/theme.ts
supersedes: none
---

**What.** The palette is chosen without pi-tui's OSC 11 colour query: COLORFGBG picks dark or light, else the terminal's own indexed colours.

**Why.** The query needs a started TUI and a reply window before the first frame, and the theme is fixed at start; the indexed fallback is what 11.3 prescribes when the background is unknown.

**Result.** frames.test.ts pins dark, light and indexed choices.

**Consequence.** If wrong, terminals that answer OSC 11 but set no COLORFGBG get indexed colours instead of the Okabe-Ito hues; adding the query later is local to main.ts and theme.ts.
