---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** Verification finding V-5: after a completed offboarding, a write into the person scope was allowed while a hand-written new record there was deleted by the next adoption, a hard delete of data the plane would accept.

**Why.** The review pass purged every never-allowed record in an offboarded scope, whenever it appeared.

**Result.** Probe V5 failed before the fix and passes after.

**Consequence.** See the decision on the sweep.
