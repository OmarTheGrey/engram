---
date: 2026-11-07
author: claude-agent
type: failure
card: L1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - packages/core/test/unit/lint/det.test.ts
  - "pnpm exec vitest run packages/core/test/unit/lint/det.test.ts"
supersedes: none
---

**What.** A security review of card L1 found that `Plane.lint` admitted any member of the scope, while `Plane.read` also applies the policy's read matrix (`readableScope`).

**Why.** A member whose level the matrix forbids from reading the scope's level was refused by `read` but got item ids, content hashes, validity times and provenance refs from `lint`, against invariant 1 (no Plane method but `read` hands an item to an actor who cannot read it). No content leaked, and on today's self-asserted surfaces it gave nothing beyond what an actor could already claim.

**Result.** `lint` now gates on `readableScope`, with the deny event naming the matrix when the actor is a member; a new test reproduces the case (failing first), and the interfaces test, whose policy has an empty matrix, now expects the deny. Core passes with the invariants.

**Consequence.** Lint findings show only what the caller may read.
