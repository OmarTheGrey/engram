---
date: 2026-11-21
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/test/unit/distill/induce.test.ts
supersedes: none
---

**What.** tsc refused the induction test's constructor parameter property under `erasableSyntaxOnly`, though vitest had run it.

**Why.** Node's type stripping cannot erase parameter properties, and vitest's transform can.

**Result.** The test now declares the field and assigns it in the constructor. tsc is clean.

**Consequence.** None.
