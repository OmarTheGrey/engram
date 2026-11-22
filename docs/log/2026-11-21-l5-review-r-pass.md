---
date: 2026-11-21
author: claude-agent
type: change
card: L5
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - research/configs/near-duplicate.json
  - packages/core/scripts/near-duplicate-pairs.ts
  - research/tests/test_near_duplicate.py
  - "uv run pytest -q research/tests/test_near_duplicate.py"
supersedes: none
---

**What.** Three minor points of card L5's verification, L5-R1 to L5-R3: the near-pair floor moves into the config, a superseding entry corrects who decided to drop the title-weighted Jaccard, and the pairs script and the result report the items the candidate cap cut.

**Why.** Rule 9 takes every parameter from the config, the log must say who decided, and arm P4 will report the capped count.

**Result.** `near_pairs_at_or_above: 0.7` in `research/configs/near-duplicate.json`; `near-duplicate-pairs.ts` writes the pass's stats per fixture; the result's `capped` is 0 on the catalogue. research/tests/test_near_duplicate.py: 7 passed.

**Consequence.** Nothing else.
