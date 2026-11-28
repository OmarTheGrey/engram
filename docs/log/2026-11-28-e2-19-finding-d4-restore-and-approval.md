---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/revalidate.ts
  - packages/core/test/unit/plane/approvals-review.test.ts
supersedes: none
---

**What.** In a scope that requires review, card D4's restore asks (it is judged as a candidate and passed no review), so under an approval block it waits in the queue; before this card's fix nothing could approve it.

**Why.** Found by the second reviewer of E2.19 (F4).

**Result.** `RevalidateOptions.review` lets a routed approver restore by presenting; ADR 0050 does not mention it.

**Consequence.** D4's ADR 0050 should note the review path; E8.8's surfaces should offer restore requests through revalidate, not promote.
