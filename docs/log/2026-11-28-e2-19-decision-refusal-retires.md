---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/approvals.ts
supersedes: none
---

**What.** A refusal retires a held candidate (one `retire` under `engram/approval/refused`, the approver's reason in it); a refused widening is one `promote` deny and the item stays active. Only an actor who could approve may refuse.

**Why.** Card E8.8 says reject retires; a candidate left held after a refusal would sit unreadable forever.

**Result.** The retired-content rule (ADR 0025) then keeps a model or tool from restating refused content in that scope.

**Consequence.** If retiring is wrong, refusal becomes a deny and the candidate stays held; the projection is unchanged.
