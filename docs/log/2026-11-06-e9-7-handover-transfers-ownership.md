---
date: 2026-11-06
author: claude-agent
type: decision
card: E9.7
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0021-twin-scopes-and-grants.md
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** Handing a role over rewrites each item the leaver owns in it with the successor as owner, one `update` event each; who reads the role stays a matter of membership, and only a user-sourced member of the person scope and of every role handed over may offboard.

**Why.** The plane holds no memberships, the harness supplies them, so reading the role needs no change; but a rewrite must keep its owner (decision D4), so without the transfer the successor could not maintain the role's memory. An agent must never erase a person.

**Result.** ADR 0021 amended. `offboard` is a core function beside adoption, not a Plane method, so the Plane surface the invariants classify is unchanged.

**Consequence.** Authority rests on self-asserted memberships until authentication exists (ADR 0027).
