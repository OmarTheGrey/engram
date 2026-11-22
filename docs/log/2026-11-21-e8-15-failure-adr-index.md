---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.15
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/tasks-and-decisions.test.ts
  - docs/decisions/README.md
supersedes: none
---

**What.** On this branch alone, `scripts/test/tasks-and-decisions.test.ts` fails its check that the ADR index is consecutive: the index lists 0041 then 0044.

**Why.** ADR numbers 0042 and 0043 belong to cards E8.12 and E8.13, which add their own index rows on their branches and have not merged; the coordinator assigned 0044 to this card (0045 and 0046 go to D3 and D2).

**Result.** `pnpm exec vitest run --config scripts/vitest.config.ts scripts/test/tasks-and-decisions.test.ts`: 1 failed, 138 passed; the failure is the missing 0042 and 0043. Every other check passes, and ADR 0044 is in `OWNER_DECIDES`.

**Consequence.** Merge E8.12 and E8.13 before this PR; the test then passes with no change here.
