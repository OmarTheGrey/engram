---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** The downgrade check runs after the owner's rules and the grant rules, before the write rule's classes and sources.

**Why.** Placed there, every denial the owner's and grant rules gave before keeps its rule id under the options.

**Result.** E2.7's refuted strict cell (an import co-member) is now denied by the trust rule, not the team rule's sources; both deny.

**Consequence.** Only rule ids of denials move, and only with the option on.
