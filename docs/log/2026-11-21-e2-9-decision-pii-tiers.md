---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
supersedes: none
---

**What.** caura's severities become tiers: high (cards, IBANs, national ids) is BLOCK, low and medium (email, phone) are REVIEW.

**Why.** An email address or a phone number in a memory is often the point of the memory ("Dana's number is..."); denying it outright under `pii: block` would refuse ordinary facts, while a card number or an SSN rarely belongs in one.

**Result.** Under `pii: block` an email is held as a candidate, a valid card is denied.

**Consequence.** If wrong, a deployment wanting every email denied cannot say so; the cost is that a held email waits for a reviewer.
