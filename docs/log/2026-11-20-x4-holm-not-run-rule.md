---
date: 2026-11-20
author: claude-agent
type: decision
card: X4
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/analysis/holm.py
  - docs/research/preregistration.md
supersedes: none
---

**What.** Proposed for the lead's registration: a hypothesis that is not run enters Holm as p = 1; until the lead registers it, `holm()` refuses a family with a hypothesis missing or passed without a p-value.

**Why.** The pre-registration's Statistics section adjusts "the five p-values" and says nothing of a hypothesis that never reports (finding RV-DES-12). p = 1 keeps m at five, so every other hypothesis is adjusted as registered and an unrun one is never supported; dropping it would lower the others' thresholds.

**Result.** The code does not apply the rule: it only refuses, and a caller who follows the proposed rule writes 1.0 explicitly. A test shows the effect: H1 at 0.01 with H2 to H5 passed as 1 is adjusted to 0.05. Cost if wrong: only the callers change.

**Consequence.** The lead's amendment of v1 decides it; `holm()` stays as it is either way.
