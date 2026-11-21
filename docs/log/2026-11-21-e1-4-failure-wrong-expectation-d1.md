---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/crash-windows.test.ts
  - "make test-one T=packages/core/test/unit/plane/crash-windows.test.ts"
supersedes: none
---

**What.** The first run of crash-windows.test.ts failed 6 of 51 cases: D1 on both backends by a wrong expectation of mine, W2b and G1 on both backends by a real gap.

**Why.** D1 asserted that Dana reads nothing after her offboarding, but she is still a member of the role scope in the test, and reads the item handed over to Lee. W2b and G1 asserted that recovery makes the store hold the projection.

**Result.** D1 now asserts that no reader gets the erased id, which is what the window is about. W2b and G1 were not weakened: they became finding E14-F1 and assert today's behaviour (the store keeps the grant, the projection and every read do not). 51 of 51 pass.

**Consequence.** None beyond finding E14-F1.
