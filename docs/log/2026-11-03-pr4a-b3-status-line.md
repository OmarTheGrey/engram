---
date: 2026-11-03
author: claude-agent
type: change
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/B3.md
  - research/configs/b3-gatemem-plane.json
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b3-gatemem-plane.json"
supersedes: none
---

**What.** Card B3's status line said its acceptance replay makes 12 calls from cassettes; it now says 12 when the card merged and 18 since.

**Why.** PR #20 added Letta to `research/configs/b3-gatemem-plane.json` (stores fake and Mem0 at #18, fake, Mem0 and Letta at #20), so the replay runs 9 sessions of 2 calls, not 6; the plan's PR 4 carried the stale count.

**Result.** Run twice on this branch, offline: "9 sessions (3 items x C5 x stores fake, mem0, letta x seeds 1)" and "model calls: 0 new, 18 from cassettes" both times. Before: "0 new model calls, 12 from cassettes". After: both counts, with when each held.

**Consequence.** None for the card's status.
