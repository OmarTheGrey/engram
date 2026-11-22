---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0010-retention-retires.md
  - docs/research/absorb/12-frameworks.md
supersedes: none
---

**What.** ADR 0010 is left unchanged by the by-id read, and no retire route is added.

**Why.** The card's brief mentions retiring ADR 0010's concern. The research note (AB-FWK-1 and its verification) meant that a caller-facing retire is a new policy decision needing an ADR, and the card puts a retire-by-id route out of scope.

**Result.** A by-id read returns no retired, erased or expired item, as `Plane.read` does not: a retired item is a reachable candidate the filter removes (`not_active`), and an erased one is gone from the projection and answers as an unknown id. Nothing ADR 0010 says changes, so no amendment is proposed.

**Consequence.** A retire-by-id card needs its own ADR first.
