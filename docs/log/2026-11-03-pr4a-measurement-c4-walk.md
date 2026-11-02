---
date: 2026-11-03
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-c4-walk.json
  - research/configs/h1-c4-walk.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h1_c4_walk.py --config research/configs/h1-c4-walk.json --out research/results/h1-c4-walk.json"
supersedes: none
---

**What.** C4's walk against C3's top 20 on GateMem's pinned full set, each checkpoint's own question, medium (MANIFEST sha256 `479f2419...`).

**Why.** The PR 3 verifier's N-1 asked where the walk makes C4 show less than C3, or something else.

**Result.** C4 shows 151,144 items against C3's 44,051 (3.43 times); C4's allowed items equal C5's 31,533 on 2,218 of 2,218 checkpoints. C4 shows fewer items than C3 on 153 checkpoints (82 access control, 11 forgetting, 60 utility), as many on 39, more on 2,026; nothing at all on 28 where C3 has candidates (23, 3, 2). On access-control checkpoints C3 shows a denied leak-target item that C4 does not on 54 (131 items), C4 one that C3 does not on 365 (1,845 items); on forgetting checkpoints 7 (34) and 285 (1,062). C4's length: median 52, quartiles 26 and 103, 0 to 222.

**Consequence.** ADR 0031's decision 4 cites these counts.
