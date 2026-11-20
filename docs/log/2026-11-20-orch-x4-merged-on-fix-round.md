---
date: 2026-11-20
author: claude-orchestrator
type: decision
card: X4
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_h1_figure.py
  - research/analysis/h1.py
  - "make test"
supersedes: none
---

**What.** Card X4 (PR #57) merged after one review and one fix round, with no second review of the fixes.

**Why.** Each of the six review findings came with the test that pins it, and in most cases with the mutant that test must kill. The fix round ran every named mutant by hand and confirmed it now fails. The changes are local to the figure script, Holm and `decide_h1`.

**Result.** After rebasing onto RV2 (#53), `make lint`, `make lint-docs`, `make api-check` and `make test` all pass: vitest 3,272 passed, pytest 310 passed. The only conflict was the AGENTS.md command list, resolved by keeping both lines.

**Consequence.** H1's analysis is complete for the registered numbers. The relative reduction stays labelled as not registered until the lead decides.
