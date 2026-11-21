---
date: 2026-11-21
author: claude-agent
type: failure
card: X15
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/bench/plane-overhead.ts
  - packages/core/test/bench/count.test.ts
  - docs/log/2026-11-21-x15-measurement-plane-overhead.md
supersedes: none
---

**What.** Card X15's first measurement timed the three presets one after another on one log and store, so each preset ran on what the earlier ones had added (review finding X15-1).

**Why.** The suite populated once per store and size and reused it. At 100 items strict ran on 100 to 311 items, medium on 311 to 522 and permissive on 522 to 733, with 0, 211 and 422 earlier reads in the log; reversed, strict was the slowest.

**Result.** The preset comparison, the band's rationale (a spread put down to machine load) and the architecture paragraph read run order as noise. The probe also counted one statement fewer on a strict read, because strict ran first, on a handle that had not yet read the log's head.

**Consequence.** Every cell now runs on its own copy of the populated store; the suite was rerun and the result recommitted.
