---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** For N-2, the kind floor of a record new to the plane is taken from every retired item of the scope with the same merging content hash, and from every item this adoption retires, not only the latter.

**Why.** That is the reviewer's fix. A retired item's kind is the best evidence of where content came from; the cost is that a person's new file restating content an agent once wrote and was retired is recorded at the agent's kind.

**Result.** P4b: the copy is `model`, and the gate's retired-content rule then refuses it outright. Invariant 6 passes with the new tamper.

**Consequence.** The floor lowers trust only; it can make a hand-written restatement less trusted than the person meant.
