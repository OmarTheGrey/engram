---
date: 2026-11-06
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/generators.ts
  - packages/core/test/property/read-pipeline.test.ts
supersedes: none
---

**What.** Adding `external` to the item provenance generator broke the core read pipeline property's coverage check: no read in its seeded runs hit the read limit.

**Why.** Seeds come from test names, so a seventh choice shifts every later draw of every property using the generator; at 300, 500 and 600 runs no read was cut, and only 16 to 33 returned anything.

**Result.** The item generator keeps its six kinds, as `arbGatedItemWithTtl` did for ttls; `external` reaches the gate through writer sources and invariant 2's targeted isolation and relearning cases, where all five invariants pass.

**Consequence.** A new enum value goes into a separate arbitrary, not an existing one.
