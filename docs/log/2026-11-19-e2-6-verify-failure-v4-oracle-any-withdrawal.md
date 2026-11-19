---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: none
---

**What.** Verification finding V-4: the dogfood oracle accepted a withdrawal restoring any earlier version, so a planted withdrawal by another principal restoring a removed grant reported 0 violations.

**Why.** The integration judged a withdrawal only against the versions the log held, not against the adoption it withdraws.

**Result.** Probe V4 failed before the fix and passes after.

**Consequence.** See the decision on the oracle's withdrawal rule.
