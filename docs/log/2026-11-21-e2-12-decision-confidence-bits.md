---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
supersedes: none
---

**What.** A confidence and a confidence floor are exported as the IEEE 754 bits of the double, two unsigned 32-bit Longs, compared lexicographically, not as Cedar's `decimal`.

**Why.** Cedar has no floats, and `decimal` keeps four decimal places, while the evaluator compares doubles and generated policies draw arbitrary double floors. For non-negative doubles the order of the bits is the order of the numbers, so the comparison is exact; -0 is encoded as 0, as JavaScript compares it.

**Result.** Writes at each preset floor and at its two neighbouring doubles agree. Turning the strict `<` into `<=` fails four tests.

**Consequence.** The floor in the text is a pair of integers; each floor policy carries a comment with the decimal value.
