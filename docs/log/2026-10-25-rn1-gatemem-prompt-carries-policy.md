---
date: 2026-10-25
author: claude-agent
type: finding
card: RN1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/bench/src/gatemem/vendor/query_prompt.txt
  - packages/runner/src/gatemem-probe.ts
  - packages/runner/src/conditions.ts
supersedes: none
---

**What.** GateMem's own query prompt carries a domain access policy (GLOBAL RULES and GLOBAL ACCESS POLICY) for every method, so in the RN1 runner, C2 on GateMem is not policy-free.

**Why.** The pre-registration defines C2 as having no policy text and C3 as the policy in the system prompt; H1 compares them.

**Result.** The runner keeps the upstream prompt in every condition, so the conditions differ only in mechanism. C3 adds the Engram preset's YAML and the requester's memberships on top. The probe also maps each GateMem turn to its speaker's person scope, with no grants from relationships. That mapping is a placeholder, and it decides what C5 admits.

**Consequence.** Before any H1 run, X1 or an amendment must decide whether C2 drops GateMem's policy block, and how GateMem principals and relationships map to scopes and grants.
