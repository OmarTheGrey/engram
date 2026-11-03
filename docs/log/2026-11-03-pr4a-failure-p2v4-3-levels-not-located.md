---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/log/2026-11-02-pr2-r3-failure-claim-small-kappas.md
  - docs/log/2026-11-02-pr2-r3-finding-h4-power.md
  - research/results/h4-power.json
supersedes: none
---

**What.** PR #26's round-3 failure entry said the round-3 finding gives its levels with where they occur, but the round-3 finding quotes no level at all.

**Why.** The measurement entry quoted the largest own levels (0.04289, 0.008271) and the finding was shortened past them; nothing checked the promise. Found by PR #26's final verification (P2v4-3).

**Result.** The superseding finding `2026-11-03-pr4a-finding-h4-power` gives both, with where they occur, read from `research/results/h4-power.json`'s `own_max` and `own_max_at` fields and the cells that hold them.

**Consequence.** None beyond the superseding entry.
