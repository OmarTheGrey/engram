---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** Review finding RV7-R5: the owner-rewrite refusal told a writer who cannot read the item's scope that the item carries grants.

**Why.** The branch hid only the owner's name. It also kept `engram/grant/owner` as its rule id, which says the same thing.

**Result.** A writer whose level the read matrix stops gets the opaque reason, under `engram/write/membership` with check `not-member`. So does the move refusal, whose rule id would otherwise name the check. The tests use a role context under another id. Mutation check: removing the branch fails the new test.

**Consequence.** The RV-CORE-2 test now expects the membership rule for the opaque case. ADR 0006's amendment says so.
