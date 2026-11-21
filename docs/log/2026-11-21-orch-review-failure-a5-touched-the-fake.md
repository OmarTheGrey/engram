---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: A5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/A5.md
  - packages/runner/src/stores.ts
  - docs/tasks/absorb-plan.md
supersedes: none
---

**What.** Card A5 changed `packages/adapters/src/fake/index.ts` in the week the plan reserves for documents and tests (review finding AP-6).

**Why.** The fake was treated as a test double only.

**Result.** It is not only that: `packages/runner/src/stores.ts` registers `fake` as a store, and the fault-set and research scripts behind committed results use it. A change there could move a committed hash days before the tag. The validity mode is now a separate double in the test tree that wraps the fake, and the card puts everything under `packages/adapters/src/` out of scope.

**Consequence.** The plan's first selection test now reads: before the tag nothing under any package's `src/` changes.
