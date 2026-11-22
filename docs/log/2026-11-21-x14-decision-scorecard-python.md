---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/redteam.py
  - research/tests/test_redteam.py
supersedes: none
---

**What.** AMSB's scorecard is ported to Python in `research/scripts/redteam.py`, not to TypeScript under `packages/bench/src/amsb/`.

**Why.** Every rate is computed from the rows in Python; a second implementation in the bench would be dead code.

**Result.** Upstream's scoring tests are ported beside it (10 tests).

**Consequence.** None. Cost if wrong: none.
