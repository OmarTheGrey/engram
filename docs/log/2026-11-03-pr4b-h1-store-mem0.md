---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem.json
  - research/configs/h1-mem-inv.json
  - research/configs/h1-table.json
  - packages/runner/test/count.test.ts
  - "make run CONFIG=research/configs/h1-gatemem.json COUNT=1"
supersedes: none
---

**What.** The three H1 configs name store `mem0` in place of PR 3's placeholder `fake`.

**Why.** Part B's brief: if the runner runs both arms on the recommended store, change all three, so the tag needs no further change once the lead accepts item 2.

**Result.** Before: `"store": "fake"` in `h1-gatemem.json`, `h1-mem-inv.json` and `h1-table.json`; after: `"mem0"`. COUNT prints "26616 = 2218 items x 4 condition-store cells (C2, C3, C4, C5 on mem0) x 3 seeds" and "456 = 38 items x 4 condition-store cells (C2, C3, C4, C5 on mem0) x 3 seeds". The count test pins the new value and `research/tests/test_h1_pipeline.py` holds the three together (both passed). `research/results/h1-cost.json` records no store, so its hash should not move; `make test-repro` checks it.

**Consequence.** If the lead changes item 2, the same four lines change.
