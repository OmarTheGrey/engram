---
date: 2026-11-27
author: claude-agent
type: finding
card: H5P
chapter: limitations
pillar: distill
hypothesis: H5
evidence:
  - packages/bench/PINS.md
  - docs/readings/litreview/2506.07982-tau2-bench.md
  - docs/log/2026-11-21-b11-finding-reward-and-judge.md
supersedes: none
---

**What.** Card B11's read of tau2's code at the pin and the literature review disagree on whether retail's natural-language assertions count in its reward.

**Why.** Review finding F11: the draft relied on the code read without stating the conflict.

**Result.** PINS.md gives retail 112 of 114 tasks DB and NL_ASSERTION, every task run under `EvaluationType.ALL`, 40 listing assertions (11 of the 40 test tasks); the review's note says the assertions are off by default and not in the default `reward_basis`. The draft follows the code at the pin and now states the conflict.

**Consequence.** The harness card's fixture test checks the reward basis at the pin.
