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
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** Verification finding N-2 of PR #58: I-5's kind floor held only within one adoption, and invariant 6 did not check it. Probe P4b deleted the agent's file and adopted, which retired its item, then added the re-filed copy with `kind: user` and adopted again: the copy adopted as `import`, the owner's grant was allowed, and Sam read the episode.

**Why.** The floor came from what the current adoption retires; the original was already retired by the earlier one. Invariant 6 judged a new id against `import` only, so deleting the floor left it green.

**Result.** The floor now takes every retired item of the scope with the same content. Invariant 6 judges a re-filed copy against the original's kind, with a tamper that adopts between the delete and the re-file; its first run caught a written-retired original.

**Consequence.** Deleting the floor in `adoptedItem` now fails invariant 6.
