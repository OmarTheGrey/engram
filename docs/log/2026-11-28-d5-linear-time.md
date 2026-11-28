---
date: 2026-11-28
author: claude-agent
type: change
card: D5
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/lint/procedural.ts
  - packages/core/test/unit/lint/adversarial.ts
  - packages/core/test/unit/lint/procedural.test.ts
supersedes: none
---

**What.** Every rule of the scan runs in linear time: credential-upload's lazy run is bounded to 200 characters, its other runs to 20 and 64, and `thenOnLine` compiles its patterns once.

**Why.** The review (finding 1) measured credential-upload quadratic, 10.6 s on 100,000 characters, inside the write queue; the old timing test missed the shape.

**Result.** A test times each of the 33 rules alone on 711 adversarial inputs of about 200,000 characters (`adversarial.ts`: every token the patterns name, after each prefix a rule starts from) under 1,000 ms each; the slowest is now 84 ms. Mutation check: the unbounded run back, the test fails at about 19 s per input.

**Consequence.** No field cap was needed.
