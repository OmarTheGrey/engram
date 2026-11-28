---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.7
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/server/test/leakage.test.ts
  - docs/log/2026-11-28-e8-16-finding-erased-rule-id.md
  - packages/core/test/unit/plane/erasure-gaps.test.ts
supersedes: none
---

**What.** A swept id is now an existence oracle of the kind card E8.16 pins for erased ids: to a non-member a write under it is refused with the masked reason under `engram/write/erased`, while a never-held id is allowed.

**Why.** Card E1.7 refuses new writes under swept ids; the rule id is the same as an erased id's, so it tells a non-member a record once lay under that id in an offboarded scope, a record the log never allowed included.

**Result.** The reason itself names nothing to a non-member (`erasure-gaps.test.ts`); the rule id does. No swept canary was added to the E8.16 leak suite: it would change its canary set and its pinned counts, which `research/results/h1-leakage.json` records, a row this card may not move.

**Consequence.** For the card that next touches the leak suite: add a swept canary to its pinned oracles beside the erased one.
