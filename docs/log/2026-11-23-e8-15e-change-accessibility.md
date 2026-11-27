---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/access.test.ts
  - packages/cli/src/tui/theme.ts
  - packages/cli/src/tui/app.ts
supersedes: none
---

**What.** Section 11 audited item by item: the mouse and --no-mouse, NO_COLOR, high contrast, the dark and light palettes, ASCII detection, reduced motion, the commands on quit, the screen-reader hint and L. Missing were the terminal's background answer (OSC 11), the busy line of 10.2 (so reduced motion changed nothing), the hint's wording and L itself.

**Why.** The card asks for the rest of section 11, each tested.

**Result.** Added an OSC 11 question read before pi-tui, the busy line on injected timers (four ASCII frames at 120 ms, a static marker under --reduced-motion), tuiOptions reading each flag, variable and saved option, and access.test.ts: 35 tests, none waiting on a clock.

**Consequence.** None beyond the frames: first-run, help and workspace snapshots updated for the hint, the key's word and the new toggle.
