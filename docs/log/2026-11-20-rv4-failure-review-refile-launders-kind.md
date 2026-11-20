---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv4-review.test.ts
supersedes: none
---

**What.** Review finding I-5 of PR #58: agent content re-filed under a new id with `kind: user` written into the file adopted as `import`, and the owner's grant on it was then allowed (probe P4: Sam read "Agent episode.").

**Why.** A new id has no plane item, so the least trusted kind was taken of the claim and `import` alone, while the same adoption retired the `model` item holding that content.

**Result.** A record new to the plane takes the kinds of items of the same content this adoption retires into the least trusted (decision entry). P4: kind `model`, the grant denied, Sam reads nothing.

**Consequence.** Invariant 6 now guards the kind of every adoption.
