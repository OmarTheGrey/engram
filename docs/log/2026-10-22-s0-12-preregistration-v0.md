---
date: 2026-10-22
author: omar
type: milestone
card: S0.12
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - research/tests/test_prereg.py
  - "uv run pytest research/tests/test_prereg.py"
  - "git show prereg-v0"
supersedes: none
---

**What.** Step-0 task S0.12 wrote pre-registration v0: the question, seven conditions, the six pinned benchmarks, three model slots, three seeds, the statistics, and for each of H1 to H5 its conditions, benchmarks, metric, test, stopping rule, analysis and results files. It is tagged `prereg-v0`.

**Why.** Gate A requires a dated pre-registration before any run (ADR 0023).

**Result.** `research/tests/test_prereg.py` passes 9 checks, including that every manifest result maps to exactly one hypothesis; removing one field makes it fail. The hypothesis wording is reconstructed from the roadmap, ADRs and literature review because the proposal was not available; thresholds are marked proposed and models are placeholders.

**Consequence.** The lead confirms or amends v0 before `prereg-v1`, which is the version deposited externally.
