---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/count.ts
  - packages/runner/test/rv6-checks.test.ts
supersedes: none
---

**What.** The acceptance command failed on a fresh clone: `make run CONFIG=research/configs/b1-gatemem-reference.json COUNT=1` stopped on missing data (review P60-2).

**Why.** COUNT fetched GateMem's pinned full set only for an experiment config, and B1's reference config is a pipeline config on the full set; this worktree had the data from an earlier H1 COUNT, which hid it.

**Result.** `fetchesPinnedData` fetches for an experiment, and for any config whose data folder does not exist (a committed fixture subset always does); live runs and replays use the same rule. Without fetching, a missing folder is refused with the command that fetches it. Tested in `rv6-checks.test.ts`; going back to experiments only fails it.

**Consequence.** B1's COUNT works on a fresh clone, with the network for the data fetch.
