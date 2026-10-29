---
date: 2026-10-29
author: claude-agent
type: finding
card: B1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - packages/bench/scripts/dry-run-gatemem.ts
  - packages/bench/test/gatemem/run.test.ts
  - "make bench BENCH=gatemem DRY=1"
supersedes: none
---

**What.** `make bench BENCH=gatemem DRY=1` runs the reference agent over GateMem's full checkpoint set with a stand-in for the answer model and reports the live run's calls and cache keys; no model is called.

**Why.** The cost of the live run should be known before the pre-registration leaves the backlog (plan, PR 6).

**Result.** On the pinned data (8 of 8 files match the manifest): 91 episodes, 2,218 checkpoints, 2,218 answer calls at 2,218 distinct keys, 60,997,919 prompt characters; the judge makes 2,218 to 6,654 calls of at least 7,351,135 characters. On the fixture the dry run's keys equal the committed cassettes' names.

**Consequence.** Long-Context's 300-turn prompt dominates the cost; the lead sees it before choosing models.
