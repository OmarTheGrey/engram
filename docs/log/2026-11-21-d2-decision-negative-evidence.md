---
date: 2026-11-21
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/induce.ts
  - packages/core/src/distill/episode.ts
supersedes: none
---

**What.** Negative evidence is each example's abandoned branches, with pi's branch summary when there is one, and its withdrawn attempts, both listed under "Abandoned attempts" with every call they made. Calls whose result is an error, and calls a context edit withdrew, are left out of the positive trajectory. A failed session is neither an example nor evidence.

**Why.** Card D2 step 3 and ADR 0012 name abandoned branches and omitted retries. AWM's `remove_invalid_steps` drops actions that did not run.

**Result.** In the fixture prompt, 5 of the 10 examples carry abandoned attempts (`fixtures/cassettes/d2-induce-fixture`).

**Consequence.** A failed session's final branch could be a later card's evidence (ReasoningBank). It is not used here.
