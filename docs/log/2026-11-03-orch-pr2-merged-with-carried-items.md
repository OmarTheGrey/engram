---
date: 2026-11-03
author: claude-orchestrator
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/scripts/h4_power.py
  - research/analysis/equivalence.py
supersedes: none
---

**What.** PR 2 (#26) merged as `b688cb0` after a review and three verification rounds, the last of which found it ready, and its three minor findings moved to PR 4 rather than a fifth fix round.

**Why.** The findings touch no result. H4's level gate checks Holm's thresholds 0.05 and 0.01, not 0.025, 0.0167 and 0.0125; the verifier's search held all three at 20 of the 26 alpha-0.01 sizes, the tightest 0.012202 against 0.0125. Some wording calls a searched maximum an exact supremum. One entry promises levels with where they occur and quotes none.

**Result.** CI, `make test`, `make test-repro` (3 of 3) and the verifier's independent enumeration and search all passed on the merged head; the squash commit's tree equals the verified head's.

**Consequence.** PR 4 checks every committed alpha-0.01 size at every Holm threshold, and supersedes the wording and the entry.
