---
date: 2026-11-21
author: claude-agent
type: decision
card: A5
chapter: implementation
pillar: plane
hypothesis: H3
evidence:
  - packages/adapters/test/plane/revocation.test.ts
  - docs/tasks/absorb-plan.md
supersedes: none
---

**What.** The three grid rows where a revoked item is admitted (lineage only, rebirth by re-edit, prose only) are plain tests that assert what the plane does today, each named "(finding)" and tied to a `finding` entry, not failing tests and not `test.fails`.

**Why.** The failures are the plane's, identical on every store, and this card may not change core; a red test would block every merge, and `test.fails` passes on any error. Card E2.7 of the same plan pins suspected gaps the same way. Nothing is marked adapter-specific.

**Result.** The grid is green and the gaps are exact: which item is admitted, and for lineage, that a store's search ranks it above its replacement.

**Consequence.** A core card that closes a gap must flip its row from "admitted" to the property, which the row's name and comment say.
