---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/explain-absent.ts
  - packages/core/src/plane/who-can-read.ts
supersedes: none
---

**What.** An answer names the stage and its rule with a fixed reason per stage, never an instant of the item (valid_from, valid_to, the ttl's expiry), its owner, or a grant; a returned item's answer names the admitting rule only.

**Why.** Who-can-read withholds those from a member asking about a closed item (review finding E2.13-1, the lead's decision); the same asker should learn no more here.

**Result.** The property test checks that no answer carries an item instant other than the read's own times, any grant's principal or the owner's id.

**Consequence.** A member who wants the window reads the item's events, which it may see.
