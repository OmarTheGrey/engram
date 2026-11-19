---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** Verification finding V-9: a purge whose delete kept failing appended two events on every adoption, forever.

**Why.** Each adoption gated the record again and recorded the failure again.

**Result.** Probe V6 failed before the fix and passes after: five adoptions over a permanently failing delete add two events in all.

**Consequence.** See the decision on purge outcomes.
