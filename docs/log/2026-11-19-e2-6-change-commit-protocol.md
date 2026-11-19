---
date: 2026-11-19
author: claude-agent
type: change
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/grants.ts
  - packages/core/src/plane/promote.ts
  - packages/core/test/unit/plane/cross-handle.test.ts
supersedes: none
---

**What.** Plane.write, Plane.changeGrants, Plane.promote and offboarding's handover now check their decision again in the transaction that appends it, and refuse a stale one under `engram/write/conflict`, `engram/grant/conflict`, `engram/promote/conflict` or `engram/offboard/conflict`.

**Why.** The write queue orders one db handle only; a second process on the same log could commit between a decision and its event (ADR 0007, finding N2; the verification of PR #44).

**Result.** Orderings R3, R4, R9, R9b, R12 and R15 fail on main and pass on branch e2-6, on SQLite and embedded Postgres (`pnpm --filter core exec vitest run test/unit/plane/cross-handle.test.ts`: 44 passed).

**Consequence.** Every store-then-log path shares one protocol in plane/commit.ts; a new operation that writes the store should use it.
