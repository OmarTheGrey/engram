---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
  - packages/core/test/unit/lint/model.test.ts
supersedes: none
---

**What.** Review finding L3-4: the unsupported-claim lint sent claims and sources past their ttl or validity; contradiction already required both to be held at the lint time.

**Why.** A source past its ttl is one Plane.read no longer returns (ADR 0025), yet its text reached the model and the model's reason a visible event; an expired claim got both expired-validity and unsupported-claim.

**Result.** Five unit cases (claim past ttl, past validity, not yet valid; source past validity, past ttl) failed, then passed once both are required to be held. The fixture replay is unchanged: 0 new calls, identical rows, no cassette recorded again.

**Consequence.** The unsupported-claim units decision is superseded by an entry of this date.
