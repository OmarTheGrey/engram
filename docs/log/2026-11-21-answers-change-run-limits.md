---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem.json
  - research/configs/h1-mem-inv.json
  - research/configs/h2-longmemeval-c2.json
  - research/configs/h2-longmemeval-c5-medium.json
  - research/tests/test_run_limits.py
  - "make run CONFIG=research/configs/h1-mem-inv.json COUNT=1"
supersedes: none
---

**What.** Four experiment configs gain `turn_limit` 8 and `spend_ceiling_usd`, held by a new test, `research/tests/test_run_limits.py`.

**Why.** Lead-decisions items 3 and 4 decide both values; the runner reads both fields since card RV1.

**Result.** Before: no limit and no ceiling. After: 8 calls; 1,560.26, 4.65, 203.44 and 205.76 dollars. The test failed first (9 of 10), then passed; mutating the GateMem ceiling to 1,560.30 failed two of its tests. Neither field is in a cache key or `count.json`: `make run CONFIG=research/configs/h1-mem-inv.json COUNT=1` wrote `count.json` with sha256 `943c8816...` from the old config and the new. B6's test now lets its two configs' ceilings differ.

**Consequence.** No committed result moves; H1's live run stops at its ceiling.
