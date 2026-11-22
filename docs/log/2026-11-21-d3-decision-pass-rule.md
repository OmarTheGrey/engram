---
date: 2026-11-21
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/validate.ts
supersedes: none
---

**What.** A held-out task passes when its mean reward over the seeds with the candidate is at or above the threshold; n is the held-out tasks, not task-seed runs; the baseline is reported, not required.

**Why.** The card's "k of n held-out tasks at or above the threshold" and its goal "helps on at least k of n" leave the per-seed aggregation and the role of the session without the candidate open.

**Result.** With 0 or 1 rewards and threshold 1 a task passes only if it passes at every seed. Requiring the candidate to beat the baseline would make admission impossible on tasks the agent already solves.

**Consequence.** A candidate that only matches the baseline can be admitted; the reason's baseline count shows it.
