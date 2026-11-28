---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/model/replay.ts
  - docs/log/2026-11-28-e1-8-measurement-trace-replay.md
supersedes: none
---

**What.** The first results row overstated the replay: 183 of 200 replayed, every divergence explained.

**Why.** The independent review found that item status was not compared (38 retired item ends passed as live), that a divergence was explained by any finding's mark anywhere in the trace (replay-074 was misfiled), and that the trail dropped every unlisted `engram/*` event.

**Result.** Status is compared, the trail keeps every event but retractions, and attribution needs a mark about the diverging item at or before its step and of a kind it can cause. The row now reads 144 of 200; a new finding, E18-F8, was split out.

**Consequence.** The superseding measurement entry carries the corrected numbers.
