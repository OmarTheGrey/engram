---
date: 2026-11-25
author: claude-agent
type: decision
card: E9.9
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/test/unit/policy/promotion.test.ts
supersedes: none
---

**What.** The acceptor must be both the item's owner and the person whose scope it is, at the person level.

**Why.** An item another writer put into the person's scope naming themself owner is already reviewable by the scope's person under ADR 0026, who is neither its owner nor author.

**Result.** That case stays a review (`<policy>/promotion/review`); a test pins it. Cost if wrong: none found, both paths admit it.

**Consequence.** Nothing.
