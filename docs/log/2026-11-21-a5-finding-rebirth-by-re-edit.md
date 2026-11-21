---
date: 2026-11-21
author: claude-agent
type: finding
card: A5
chapter: discussion
pillar: plane
hypothesis: H3
evidence:
  - packages/adapters/test/plane/revocation.test.ts
  - packages/core/src/plane/write.ts
  - "make test-one T=packages/adapters/test/plane/revocation.test.ts"
supersedes: none
---

**What.** After a revocation through the plane, the old record put back in the store by its own means comes back only if it is re-edited at a higher version.

**Why.** The Memory-Rebirth-Attack scenario: a revoked fact re-entering the store outside the gate.

**Result.** Restoring the pre-revocation record (version 1, a backup or a git revert) is denied by `engram/write/version` on adoption, nine of nine, and nothing is readmitted. Re-editing it active at version 3 is adopted as the owner's import, one allowed adoption event per scenario naming the store, and it is admitted again, on every store. ADR 0025 allows this (an import may restate retired content), and a revocation written as status `retired` is not counted by `retiredContent` at all.

**Consequence.** Revocation holds against relearning sources, not against the store's owner editing the store; the lead should say whether that is the intended trust boundary.
