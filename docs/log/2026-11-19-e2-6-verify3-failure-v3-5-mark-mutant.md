---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: none
---

**What.** Finding V3-5: the mutant that lets every report close every mark survived.

**Why.** No test had one offboarding report while another, begun later, was still running.

**Result.** The new test (A begins, B begins, A reports, the scope stays frozen, B reports) kills it on both backends.

**Consequence.** None.
