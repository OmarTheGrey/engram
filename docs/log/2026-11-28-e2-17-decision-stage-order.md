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
  - packages/core/src/plane/read.ts
supersedes: none
---

**What.** The answer names stages in the read's own order (reach, match, then evaluateRead's status, ttl, access, validity, then the rank cut), not the card's listed order "scope, grant, validity, status, rank cut".

**Why.** The first rule that excluded an item is the one the read applied first; evaluateRead judges status and ttl before access and validity. An item both retired and outside its window is counted not active by the read.

**Result.** The property test counts stages against the read event's own counts, so any other order fails as soon as an item fails two checks (the mutant above).

**Consequence.** If wrong, only the order of the stage list changes; the read is untouched.
