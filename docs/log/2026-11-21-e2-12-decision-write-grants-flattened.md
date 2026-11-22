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
  - packages/core/test/property/cedar.test.ts
supersedes: docs/log/2026-11-21-e2-12-decision-grant-flattening.md
---

**What.** Grants on the write path are flattened, not excluded, wherever a whole item decides: the write request carries `existing.granted`, `granted`, `changes_grants` (the evaluator's `sameGrants`, or a class change under grants) and `in_place_promotion`, and the actor its `source`. Cedar judges `engram/grant/owner` (both branches, with the opaque refusal), `engram/grant/source` and an untrusted source carrying grants.

**Why.** Review finding E2.12-3: under medium a user-sourced co-member rewriting the owner's granted item was denied by the evaluator and allowed by Cedar. The lead chose to flatten.

**Result.** Still excluded: the rules judged grant by grant (shape, repeats, another class, expiry at addition), since Cedar has no quantifier over a set and flattening one would be the encoder computing the verdict. Those writes are counted, not compared. The read path is flattened as before.

**Consequence.** Generated writes now carry grants; the coverage guard requires each grant rule to decide more than 20 times.
