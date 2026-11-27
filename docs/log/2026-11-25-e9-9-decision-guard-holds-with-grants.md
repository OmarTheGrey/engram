---
date: 2026-11-25
author: claude-agent
type: decision
card: E9.9
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/test/unit/plane/owner-accepts.test.ts
  - docs/decisions/0049-owner-accepts-in-own-person-scope.md
supersedes: docs/log/2026-11-25-e9-9-decision-guard-holds-accepted.md
---

**What.** The owner alone accepts a content guard's hold only when the item carries no live grant; a held item with a live grant keeps ADR 0026's independent reviewer (the orchestrator's answer to review finding E99-2).

**Why.** The earlier entry said the cost stayed with the owner. It does not: once released, held personal data or a secret reaches every live grantee, and that needs a second person.

**Result.** With Dana's email granted to Sam, Dana is refused under `engram/promote/reviewer`, with a reason naming 1 live grant and `engram/write/pii`, and Sam still reads nothing. A second member, Lee, releases it under the review rule. An expired grant does not stop her. Injection-screen holds stay acceptable by the owner, since that content carries no grants.

**Consequence.** ADR 0049 decision 5 is amended to match. The guards are off in every registered preset, so nothing registered moves.
