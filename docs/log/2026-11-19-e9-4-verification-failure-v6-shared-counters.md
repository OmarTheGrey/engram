---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** Verification finding V-6 of PR #44: invariant 5's two walks shared one set of counters, so the grant walk could satisfy the first walk's coverage guards.

**Why.** Both walks incremented the same `seen` and one guard checked it after both.

**Result.** Fixed by decision `2026-11-19-e9-4-verification-decision-own-counters.md`.

**Consequence.** None.
