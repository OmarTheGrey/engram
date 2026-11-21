---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** The owner's agent, model-sourced and acting under the owner's id, still rewrites the owner's granted item. RV-CORE-1's rule compares the actor's id with the owner, not the actor's source.

**Why.** The finding is about another member's text read under the owner's name, and an agent acting under the owner's id is not another member. A grant change stays user-sourced only (ADR 0034, decision 2), since that is consent itself. Refusing the agent's content rewrites would also stop the twin's own sessions from updating granted role memories.

**Result.** No test changed. The existing source rule for grant changes still holds (`write-grants.test.ts`: the owner's agent may not change the grants by a rewrite).

**Consequence.** Left for the lead. A stricter reading would make content rewrites of granted items user-sourced only, which is one more condition in the same branch.
