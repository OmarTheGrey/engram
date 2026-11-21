---
date: 2026-11-21
author: claude-agent
type: failure
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/runner/test/session-fixtures.test.ts
  - "make lint"
supersedes: none
---

**What.** `make lint` failed twice in card D1's last fix pass. Biome flagged an unsafe optional chain in the new recovered-fixture check. Then tsc could not find the module `@engram/server` from `packages/bench/src/merit/seam.ts`.

**Why.** The test cast `retry?.message` before reading `.role`, which throws when `retry` is undefined. The second failure was not in this card's code: the rebase brought in card B7's new dependency of `packages/bench` on `@engram/server`, and the worktree's install predated it.

**Result.** The chain now reads `?.role`. After `pnpm install --frozen-lockfile --prefer-offline`, `make lint` exits 0. The 54 fixture tests pass.

**Consequence.** After a rebase that adds a workspace dependency, the install runs again before the gates.
