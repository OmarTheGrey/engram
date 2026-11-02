---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/scripts/compare-c4-verdicts.ts
  - "make lint"
supersedes: none
---

**What.** The first `make lint` of the review fix pass failed: biome refused an assignment inside an expression (`const kind = (leaks[k] ??= {...})`) in the new verdict comparison script.

**Why.** The script was formatted with `biome check --write`, which cannot fix that rule, and committed before the full lint ran.

**Result.** The assignment is its own statement; `make lint` passes, and the script prints the same counts (235,384 items agree).

**Consequence.** None.
