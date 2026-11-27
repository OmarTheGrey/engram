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
  - packages/cli/test/tui/frames.test.ts
supersedes: docs/log/2026-11-22-e8-15b-decision-colour-query.md
---

**What.** When the terminal names no background (no COLORFGBG, no OSC 11 answer), status symbols are bold with no colour: the palette "unknown", not the terminal's indexed colours. This replaces the earlier entry's indexed fallback; there is still no OSC 11 query.

**Why.** Review M3: no indexed hue reaches 4.5:1 on both a dark and a light default background, and Windows sets no COLORFGBG, so the indexed fallback was the usual case there.

**Result.** frames.test.ts pins a bold, uncoloured symbol with no background known.

**Consequence.** Windows terminals show no hue unless COLORFGBG is set; the OSC 11 query would bring the hues back.
