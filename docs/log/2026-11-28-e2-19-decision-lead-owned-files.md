---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Two lead-owned files changed: the oracle gains `approvalAdmits`, read by `promotionPermitted` only when the policy has an approval block, and the invariants file's surface check classifies `approvals`, `refuse` and `expireRequests`, each called by the outsider and required to leak nothing.

**Why.** The card keeps its invariant out of the invariants file, but that file fails on any unclassified Plane method, and the oracle had to know a held write lands only through a routed approver.

**Result.** No generated policy in the invariants file sets the block, so its cases are unchanged; `make test-invariants`: 23 passed.

**Consequence.** A second reviewer is needed for both, as testing.md requires.
