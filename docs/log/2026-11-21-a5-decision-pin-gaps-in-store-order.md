---
date: 2026-11-21
author: claude-agent
type: decision
card: A5
chapter: implementation
pillar: plane
hypothesis: H3
evidence:
  - packages/adapters/test/plane/revocation.test.ts
supersedes: docs/log/2026-11-21-a5-decision-pin-gaps-as-characterisations.md
---

**What.** The rows where a revoked item is admitted (lineage only, rebirth by re-edit, prose only) stay plain tests asserting what the plane does today, each named "(finding)", and the lineage rows now pin the ranking mechanism rather than an outcome: the plane's order follows the store's hit order, in both write orders.

**Why.** The behaviour is the plane's, identical on every store, and this card may not change core; card E2.7 of the same plan pins gaps the same way. The earlier entry said a store's search ranks the old version above its replacement, which the review showed is a tie-break in store order, not a property.

**Result.** The grid is green: 91 of 91 tests.

**Consequence.** A core card that changes what a read admits flips these rows to the property.
