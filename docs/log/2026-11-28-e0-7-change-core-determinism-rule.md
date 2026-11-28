---
date: 2026-11-28
author: claude-agent
type: change
card: E0.7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/core-determinism-rule.test.ts
  - packages/core/src/db/postgres.ts
  - packages/core/src/db/postgres-worker.ts
  - packages/core/src/distill/episode.ts
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run --project scripts scripts/test/core-determinism-rule.test.ts"
supersedes: none
---

**What.** A source rule, `scripts/test/core-determinism-rule.test.ts`: no `Date.now`, argument-free `new Date`, `Date()`, `performance.now`, `process.hrtime`, `Math.random` or crypto random call in code under `packages/core/src`, the Postgres transport's `Date.now` apart.

**Why.** Rules 4, 6 and 7 and H1's replay claim rest on core reading no clock and drawing no randomness, which only convention enforced; crosswalk claim C44 had no test.

**Result.** 37 tests pass: 15 refused probes, 15 passing probes (comments, strings, regex literals, `new Date(x)`, `Date.parse`), the comment at `src/distill/episode.ts:491` passing, the real tree clean, both exemptions still used at lines 34, 41, 54 and 211, 229, and every core file blanking to balanced brackets. Mutant (`Math.random()` and `performance.now()` appended to a core source) killed. No source file changed.

**Consequence.** A clock or random call added to core fails `make test` with its file and line.
