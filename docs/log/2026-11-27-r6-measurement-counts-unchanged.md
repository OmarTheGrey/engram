---
date: 2026-11-27
author: claude-agent
type: measurement
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem.json
  - research/configs/h1-mem-inv.json
  - "make run CONFIG=research/configs/h1-gatemem.json COUNT=1"
  - "make run CONFIG=research/configs/h1-mem-inv.json COUNT=1"
supersedes: none
---

**What.** The card's two COUNT=1 comparisons, run after the fix pass. Each count ran on the branch's config, then on `origin/main`'s config (with #117) in the same worktree, offline, with no model called. The branch configs were restored afterwards.

**Why.** Review finding 4: the acceptance's counts were not recorded. `require_parameters` added one more field to the pin.

**Result.** For each config, the two `count.json` files are byte identical. `h1-gatemem`: sha256 `aa7fd0b7f50ca03e96f79be2ff51dca148d494c0ef13b3db581ed201168efaa7`, 26,616 sessions, 6,654 per condition. `h1-mem-inv`: sha256 `943c881643807e8a21fd358072dedfb70e8a4780787ddbce94b0022143344569`, 456 sessions, 114 per condition. The printed lines differ only in node's process id. These hashes match the ones the PR recorded on 2026-11-26. `make test-repro` was not run here, since the orchestrator runs it serially.

**Consequence.** The pin is not part of any count. The test-repro part of the acceptance is still owed.
