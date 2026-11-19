---
date: 2026-11-20
author: claude-agent
type: change
card: RV7
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/src/policy/promotion.ts
  - packages/core/test/unit/plane/write-grants.test.ts
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** A rewrite of an item that carries grants is now its owner's only, whatever it changes (`engram/grant/owner`). The one exception is a reviewer's in-place promotion, which changes only the status and the version (core review finding RV-CORE-1).

**Why.** A role co-holder could rewrite the owner's granted item and keep its grants. The grantee then read the co-holder's text under the owner's name, which breaks ADR 0034's rule that a grant reads as its owner's consent.

**Result.** On main, the review's repro and four more cases in `write-grants.test.ts` failed: content rewrite, expired grants, adoption by a co-holder, and a co-holder after a handover. All pass now. The owner's rewrite, the successor's rewrite and a reviewer's in-place promotion still land. Mutation check: dropping the promotion exemption fails the promotion test. The E9.4 test that let the co-holder's rewrite land now tests the owner's.

**Consequence.** ADR 0034 has a proposed amendment for the lead.
