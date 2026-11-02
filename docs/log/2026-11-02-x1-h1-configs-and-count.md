---
date: 2026-11-02
author: claude-agent
type: change
card: X1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem.json
  - research/configs/h1-mem-inv.json
  - packages/runner/src/count.ts
  - packages/runner/test/count.test.ts
  - "make run CONFIG=research/configs/h1-gatemem.json COUNT=1"
  - "make run CONFIG=research/configs/h1-mem-inv.json COUNT=1"
supersedes: none
---

**What.** H1's full-size configs, and `make run CONFIG=<file> COUNT=1`, which checks a config's data against the pinned hashes (fetching GateMem's pinned files when missing) and prints the sessions per condition, store and seed, calling no model and opening no cassette.

**Why.** Plan decision 6: the tagged commit must hold H1's exact protocol, and PR 4's cost table multiplies these counts.

**Result.** `h1-gatemem`: every checkpoint of the pinned full set (727 access control, 763 active forgetting, 728 utility), C2 to C5, seeds 1 to 3: 26,616 sessions. `h1-mem-inv`: 38 cases (32 attacks, 6 benign), 456 sessions. With one GateMem file removed, COUNT fetched it at `a983828` and counted the same.

**Consequence.** PR 4 reads `count.json` for its cost table; each H1 arm starts with one `LIVE=1` command once M1 is named.
