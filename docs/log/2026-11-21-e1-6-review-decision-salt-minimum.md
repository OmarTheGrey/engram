---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
supersedes: none
---

**What.** A chain keeper's salt must be at least 16 bytes; the shared opener gives 32 from node:crypto.

**Why.** Review finding E1.6-9: ADR 0038 asks for a random salt per event and sets no length.

**Result.** 128 bits makes a commitment to a short value as hard to confirm as guessing the salt; a shorter salt from a misconfigured keeper is refused at the append, so no event is chained under it.

**Consequence.** If wrong, the cost is one length check.
