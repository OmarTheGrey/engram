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
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/plane/write-grants.test.ts
  - docs/decisions/0006-scope-owner-grants-typed-policy.md
supersedes: none
---

**What.** A rewrite that changes an item's scope is denied unless the actor owns the item (`engram/write/move`, a new rule id on the dogfood report's list). This fixes core review finding RV-CORE-2.

**Why.** A co-holder could move the owner's granted role item into the co-holder's own person scope. The owner then read nothing, the owner's grant removal was refused as a non-member's, and the grantee kept a grant nobody could remove.

**Result.** The review's repro now ends with the owner removing the grant and the grantee reading nothing. More tests cover moving an ungranted item, the opaque refusal, and the owner's own move. The three refusal tests failed on main. Promotion to another scope takes a fresh id, so it is untouched.

**Consequence.** ADR 0006 has a proposed amendment. The lead may prefer the stricter alternative of a fixed scope on every rewrite.
