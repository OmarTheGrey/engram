---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/core/test/property/visible-events.test.ts
  - docs/decisions/0027-http-contract-client-and-inspector.md
supersedes: none
---

**What.** `visibleEvents` shows a viewer the events it made and the events whose source or target scope it is a member of; an event naming no scope (every read, every bypass, a schema-denied write) only its maker sees.

**Why.** Plan decision 5 named the rule but not what to do with null scopes or with an event leaving a member scope.

**Result.** Recorded in ADR 0027's amendments. A property test over 1000 generated logs checks the returned events are exactly those the rule admits and that no scopeless event reaches anyone but its maker; breaking the membership rule failed 2 tests, admitting scopeless events failed 5.

**Consequence.** The inspector's timeline (PR 4) filters with it; an event leaving a scope is shown to that scope's members, which reveals the target scope's name to them.
