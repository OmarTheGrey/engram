---
date: 2026-11-28
author: claude-agent
type: finding
card: E8.17
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/keys.test.ts
  - packages/cli/test/tui/__frames__/home-120x40-ascii.txt
supersedes: none
---

**What.** Home at 120x40 has no free row: adding two commands made it scroll ("3 more below").

**Why.** The design says everything fits at 120x40; second-plan cards E8.8, E2.20, E9.15 and E9.16 each add commands.

**Result.** This card used `home: false`; others will need the same, or Home a second column, or the design a different rule.

**Consequence.** For the lead or the TUI owner: decide how Home grows before those cards merge.
