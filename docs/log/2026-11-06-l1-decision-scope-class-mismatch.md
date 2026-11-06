---
date: 2026-11-06
author: shady
type: decision
card: L1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/det.ts
  - fixtures/faults/scope-class-mismatch.flag.json
supersedes: none
---

**What.** scope-class-mismatch flags an active item whose scope level has no write rule in the current policy, or whose rule now lists its class in `forbidden_classes`. Severity error.

**Why.** The write gate stops such writes, so the fault arises only when the policy changes after the write. The lint answers which landed items the new policy would refuse. Allowed sources and confidence floors are not judged; the card names scope and class only.

**Result.** The fixture writes an episodic item into team scope under a permissive policy and lints under one forbidding episodic items in team scope; the near-miss keeps the episodic item in person scope.

**Consequence.** Nothing retires a flagged item; a member decides.
