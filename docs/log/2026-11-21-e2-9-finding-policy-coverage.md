---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/src/policy/backtracking.ts
  - "pnpm exec vitest run --project @engram/core --coverage --coverage.include=**/src/policy/**"
supersedes: none
---

**What.** Branch coverage of `packages/core/src/policy/` over the whole core project, on this branch and on main at `1c458f0`.

**Why.** The card asks that 100 percent branch coverage on `policy/` stays.

**Result.** On main it was already below 100: 98.71 percent of branches, with gaps in `load.ts` (line 122), `promotion.ts` (64, 250) and `retention.ts` (113, 174, 195). On this branch: 99.03 percent, the same gaps and no new one; `secrets.ts`, `backtracking.ts` and `evaluate.ts` are at 100 percent of statements and branches. The core project passed 2,012 tests, 1 skipped, in 58 s.

**Consequence.** The gaps predate this card and are in files it does not own; closing them is a small test card.
