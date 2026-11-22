---
date: 2026-11-21
author: claude-agent
type: failure
card: D3
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - scripts/test/tasks-and-decisions.test.ts
  - docs/decisions/0046-replay-validation-source.md
supersedes: none
---

**What.** Card D3's ADR took number 0042 without checking the other cards in flight, and it was left out of `OWNER_DECIDES`.

**Why.** Only main was checked for the next free number, and `scripts/test/tasks-and-decisions.test.ts` was not run, although it refuses a proposed ADR that is not in `OWNER_DECIDES`.

**Result.** Cards E8.12 and E8.13 and the TUI design hold 0042 to 0044, so the ADR is now 0045 and is in `OWNER_DECIDES`. `make test-one T=scripts/test/tasks-and-decisions.test.ts` gives 137 passed and 1 failed. The failure is the consecutive-numbers test, and it is expected until 0042 to 0044 are on main.

**Consequence.** A card that drafts an ADR runs the decisions test and checks the numbers held by other branches.
