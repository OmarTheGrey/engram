---
date: 2026-11-20
author: claude-agent
type: change
card: RV8
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - research/scripts/frontier_axes.py
  - packages/runner/scripts/frontier-axes.ts
  - research/configs/frontier-axes.json
  - research/tests/test_frontier_axes.py
supersedes: none
---

**What.** Candidate frontier axes are measured offline: 16 variants of preset medium (grant honouring, the person reader's read width, five person-episodic budgets, six ttls, and model content at write) on all 2,218 GateMem checkpoints and all 500 LongMemEval questions.

**Why.** RV-DES-2: the presets admit and deny the same items on GateMem and differ on LongMemEval only by ttl, so H2's knee has no axis yet.

**Result.** The TypeScript entry point builds each variant, validates it with core's parsePolicy, and reuses reachOf and scoreReach (GateMem) and clockRowFor (LongMemEval); Python only summarises. 8 tests pass, among them the axes moving on the committed fixtures. About 76 minutes on 16 workers.

**Consequence.** The lead can choose axes from the measurement entry and register them by amendment before X6.
