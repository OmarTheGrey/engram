---
date: 2026-11-19
author: claude-agent
type: finding
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Offboarding deletes the store records before it commits its erasure, and three writers on another handle that commit in that window leave erased content readable (verification of PR #44, findings V-1 to V-3).

**Why.** The write queue orders one handle only (ADR 0007, N2). Orderings, on two handles of one log, twin profile: R2, offboarding deletes the record and is held before committing while a grant change commits on the other handle, rewriting the record. R3, an owner's `Plane.write` rewrite adding a grant is held at its store write while the offboarding completes. R4, the handover is held at its store write while the owner removes a grant, then writes the version it read, undoing the removal.

**Result.** In each the grantee `person:sam` reads what should be gone or ungranted; in-place promotion has the same shape. Not fixed here.

**Consequence.** Card E2.6 fixes every store-then-log path; three backlog rows.
