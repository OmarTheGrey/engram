---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
supersedes: none
---

**What.** Each gap the model found is pinned as its own test, the finding id in its name, run with `strict` on and expected to fail as it does today; the main property relaxes exactly that check and keeps searching.

**Why.** Card E1.4 step 5: the gate stays green and the gap stays pinned. Unrelaxed, the property would stop at the first gap and find nothing else.

**Result.** Three relaxations: after a crash the store's grants may exceed the projection's, never lack one (E14-F1); the oracle detail "grants on an item that held untrusted content" is filtered and counted (E14-F3); recovery may take up to three adoption passes (E14-F4). Every other check, the oracle's included, is unchanged.

**Consequence.** When core fixes one, its pinned test fails and the relaxation goes with it. If wrong, another defect behind the same message or extra pass goes unseen.
