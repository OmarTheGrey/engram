---
date: 2026-11-25
author: claude-agent
type: change
card: E9.9
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/unit/oracle.test.ts
  - packages/core/test/unit/plane/owner-accepts.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Card E9.9's review fix pass for findings E99-1 to E99-4.

**Why.** Review findings E99-1, E99-3 and E99-4, and the orchestrator's decision on E99-2.

**Result.** Invariant 2's owner run draws its source in person:b one time in four, and when the owner is not person:a it draws person:a as the author three times in four. Dropping core's scope or owner clause now fails it. Two oracle unit cases (an author who is not the owner, a role context the matrix admits) fail when either clause is dropped from the oracle. The original 1000 cases are unchanged, and their guards are checked before the owner run, which counts apart. `make test-invariants`: 21 tests passed.

**Consequence.** The CLI help says "semantic candidate"; the card names the right ADR 0026 file and `commands.test.ts`.
