---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/who-can-read.test.ts
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** A who-can-read query appends no event, and a refusal is a 200 response with `answered: false`, not an HTTP error.

**Why.** The query decides nothing and changes nothing, as `explain` and the events route do not; rule 3 covers policy decisions. A response, not a 404, keeps the refusal one shape for an unknown and a hidden id, so no status code can tell them apart, and follows ADR 0027 decision 6 (a decision is a response).

**Result.** The leak property and the Plane surface check of invariant 1 assert the event count is unchanged by every query.

**Consequence.** Who asked whom about what is not audited. If the lead wants that, an `explain`-like read event for the query is a later card; it would itself need the visibility rule.
