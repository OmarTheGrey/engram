---
date: 2026-10-22
author: claude-agent
type: change
card: none
chapter: evaluation
pillar: research
hypothesis: H4
evidence:
  - docs/research/preregistration.md
  - research/tests/test_prereg.py
  - docs/architecture.md
  - docs/decisions/0004-provenance-and-source-trust.md
supersedes: none
---

**What.** Pre-registration v0.1: Holm adjusts the five primary p-values and intervals are reported unadjusted, H4 carries a power caveat to resolve before v1, and a test requires concrete models from v1. The architecture no longer calls the ADRs proposed, and ADR 0004 records `provenance.model` as implemented.

**Why.** The final step-0 review found "Holm-adjusted interval" mixed two procedures, H4's 2-point equivalence margin on about 100 items per model likely underpowered, and the models test passing on placeholders.

**Result.** The new models test fails when a v1 row is added with placeholders and passes on v0.1; 10 pre-registration checks pass.

**Consequence.** `prereg-v0` still marks v0; v0.1 is a dated revision before v1.
