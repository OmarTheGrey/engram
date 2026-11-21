---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: E2.7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/E2.7.md
  - docs/tasks/absorb-plan.md
supersedes: none
---

**What.** Card E2.7 said tests written with `it.fails` keep the suite green whichever way they come out, which is wrong (review finding AP-4).

**Why.** The card was to prove or refute two suspected gaps without turning a gate red.

**Result.** `it.fails` turns red when its assertion passes, so a refuted gap would fail the suite, and it passes on any unrelated throw. The card now asks for characterisation tests: plain tests asserting what the plane does today, named for the gap, each asserting the specific decision and reason. Card E1.4 uses the same form for a crash window that does not recover.

**Consequence.** Card E2.11 adds each test's counterpart under the trust options instead of flipping a marker.
