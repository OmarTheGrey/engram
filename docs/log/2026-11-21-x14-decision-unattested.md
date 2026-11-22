---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/redteam/routes.ts
  - packages/core/src/policy/trust.ts
supersedes: none
---

**What.** The write route has a sixth cell, `unattested`: the scenario's person writing with no attested source while the item claims user.

**Why.** Card E2.11's unattested floor acts only on such a write; without the cell the trust setting would measure nothing on this corpus. The read route has no such cell, since adoption always attests import.

**Result.** Medium believes the claim (recorded as user); the floor denies every one of 1,726 entries.

**Consequence.** protect_trusted stays unexercised (a finding). Cost if wrong: one cell.
