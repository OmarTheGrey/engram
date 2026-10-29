---
date: 2026-10-29
author: claude-orchestrator
type: change
card: E2.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/items.test.ts
  - "pnpm exec vitest run packages/core/test/unit/items.test.ts"
supersedes: none
---

**What.** The migration 2 backfill test added in review round 2 on PR #2 now runs migrations 1 and 2 only, as the other migration 2 tests already do.

**Why.** It asserted that `migrate` applies exactly migration 2. PR #5 adds migration 3, so after the restack it saw `[2, 3]` and failed.

**Result.** What the test checks about migration 2's backfill is unchanged, and `items.test.ts` passes at the PR #5 head (29 tests).

**Consequence.** Each migration test pins the migrations it is about, so a later migration cannot break it.
