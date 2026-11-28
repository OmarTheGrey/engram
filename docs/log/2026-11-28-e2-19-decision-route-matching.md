---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/src/policy/load.ts
supersedes: none
---

**What.** A route naming the target scope beats one naming its level; two routes for one key, and `owner` off a person route, are loader errors; `role:<id>` names every member of that role scope; self-approval keeps ADR 0026's `engram/promote/reviewer`, asked before the route.

**Why.** E2.14 left order and matching to this card. Refusing duplicates means order never decides. A second rule id for self-approval, as the research proposed, would split one rule's trail.

**Result.** Unit tests pin each; the property file's routed writer is refused under the reviewer rule.

**Consequence.** Plane.simulate's candidate is checked by schema only, so there a duplicate route takes the first.
