---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/trust.ts
supersedes: none
---

**What.** The floor records `external` and sets the provenance actor to the writing actor's id.

**Why.** ADR 0040 says the least trusted kind; core's order (`leastTrusted`) puts `external` last. The claimed actor is unattested too.

**Result.** A floored item is `external`, carries no grant, stays in person scope and cannot restate retired content; its actor is who wrote it, not who it claimed.

**Consequence.** If the lead wants the least trusted kind the policy admits instead, `unattestedFloor` changes in one place.
