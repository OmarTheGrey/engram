---
date: 2026-11-22
author: claude-agent
type: finding
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - scripts/test/tasks-and-decisions.test.ts
  - docs/decisions/README.md
  - "make test-one T=scripts/test/tasks-and-decisions.test.ts"
supersedes: none
---

**What.** This branch cannot merge before ADRs 0042 to 0045 are on main. It adds ADR 0046 to the index, and the scripts project's test requires the index's ADRs to be numbered consecutively.

**Why.** Review finding D2-11. ADRs 0042 to 0045 come from cards E8.12, E8.13, the E8.15 design and one more absorb card, and none of them is on main yet.

**Result.** On this branch the test fails one of 138 cases, "the index lists ADRs 0001 to 0023 and every later one, consecutively", and passes the rest.

**Consequence.** Card D2 merges after E8.12, E8.13, the E8.15 design and D3. Merging it first would break `make test`.
