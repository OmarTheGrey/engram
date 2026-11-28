---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/bench/src/residue/check.ts
  - packages/core/test/unit/plane/erasure-gaps.test.ts
  - docs/log/2026-11-28-e1-7-decision-f7.md
supersedes: none
---

**What.** Card E1.7's store paths are two fault-injecting wrappers over the real store: a delete refused for good (person 1, slot 5, left_in_store) and a record that moved (person 2, slot 5, not_found_in_store). The put-back race itself is not replayed.

**Why.** The put-back leftover needs paused stores on two log handles, which the core test builds. Its end state, a record under an erased id after an erasure that found none at its ref, refused by adoption and kept by the sweep (F7's rule), is the moved-record case. Both wrappers leave the record's bytes in the store, so the scan sees what a person would.

**Result.** Both records are found as residue on every backend and store.

**Consequence.** The limits name the race as not replayed. Cost if wrong: a third case, not a different count.
