---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - packages/core/test/unit/plane/crash-windows.test.ts
  - "make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: none
---

**What.** Finding E14-F1: a write or grant change that adds a grant and is killed after its store write leaves the grant in the store's record for good; adoption drops it from the projection only.

**Why.** The stateful model's first counterexample (seed -19116893, path "1:2:1:1:1", shrunk four times): `[twin, write(dana, 0, grant, crash commit-before), reopen()]`. Crash-window cases W2b and G1 show it for a rewrite and a grant change.

**Result.** No reader is let in: the grantee reads nothing before or after recovery, and adoption records the item without the grant, naming the grantee (invariant 7 holds). But adoption never rewrites the store, so store and projection disagree on grants after recovery, for good. Pinned in tests named `E14-F1`; the main property compares grants laxly after a crash.

**Consequence.** For the lead: whether adoption, or the owner's next write, should rewrite such a record. Core is unchanged.
