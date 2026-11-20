---
date: 2026-11-20
author: claude-orchestrator
type: finding
card: RV4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0004-provenance-and-source-trust.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** The verification of RV4's second fix pass approved invariants 6 and 7 and left three minor findings. Two of them correct what the fix pass's decision entries claim.

**Why.** R-1: the kind floor does not record a person's restatement of retired agent content at the agent's kind, as the decision entry `2026-11-20-rv4-decision-review2-floor-from-retired.md` says. The retired-content rule refuses it. R-2: the owner's denied edit stays in the file only until the plane next writes that item, not indefinitely as `2026-11-20-rv4-decision-review2-match-over-projection.md` says. R-3: a dropped hit still takes a slot of a capped store search.

**Result.** The ADR 0004 amendment now states all three. R-1 and R-3 are backlog rows.

**Consequence.** None of the three affects the twin dogfood as specified.
