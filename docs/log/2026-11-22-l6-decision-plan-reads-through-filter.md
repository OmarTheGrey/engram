---
date: 2026-11-22
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/supersede.ts
  - packages/core/test/property/supersede-leak.test.ts
supersedes: docs/log/2026-11-21-l6-decision-plan-reads-as-actor.md
---

**What.** `planSupersession` takes part only items `evaluateRead` admits for the actor at `at`, as the start, as chain links and as candidates. A start the actor cannot read gets the unknown id's answer word for word, and an unreadable item changes nothing in the plan.

**Why.** This is the lead's fix for L6-1. `readableAt` checked scope or grant only, so candidates, retired, expired and not-yet-valid items were shown and could be rewritten.

**Result.** The leak property checks four claims over generated logs: the unknown-id answer, an identical plan without the hidden items, no hidden content or instant in the JSON, and an identical refusal on accept.

**Consequence.** A replacement dated in the future cannot be planned until it becomes valid.
