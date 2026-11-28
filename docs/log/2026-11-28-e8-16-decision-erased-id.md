---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.16
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage-kit.ts
  - packages/server/test/leakage.test.ts
supersedes: none
---

**What.** For the erased canary, a leak is its nonce, shown to anyone; its item id is not counted, since erasure keeps the audit trail (ADR 0010).

**Why.** Offboarding redacts content in every earlier event and keeps the events, ids and reasons: the members of the erased person scope (fred himself, the one who offboarded him) still see that scope's events, which name the id.

**Result.** No surface shows the erased nonce to any actor, its scope's members included (a dedicated HTTP test as the offboarder and as fred).

**Consequence.** Recorded as a finding, not a leak; if the lead wants ids gone too, that is an ADR 0010 amendment.
