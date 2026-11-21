---
date: 2026-11-21
author: claude-agent
type: change
card: D2
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/induce.ts
  - packages/core/test/unit/distill/induce.test.ts
  - "make test-one T=packages/core/test/unit/distill/induce.test.ts"
supersedes: none
---

**What.** Core gains AWM's induction (`induceAwm`, `createAwmDistiller`, a `Distiller`), its rule-based control (`induceByRule`), and `distillRef` and `parseDistillRef`.

**Why.** Card D2 steps 2 to 4.

**Result.** Sessions are parsed and scrubbed before any prompt sees them. Judged successes are the examples. A reply's workflow becomes a candidate only if it has at least two actions, makes only tool calls, uses only tools that succeeded, and gives a valid and unique SKILL.md. 14 tests pass. Dropping the negative evidence fails 1 test, and keeping failed calls fails 3.

**Consequence.** The runner wires it (entry 2026-11-21-d2-runner).
