---
date: 2026-11-19
author: claude-agent
type: finding
card: L3
chapter: evaluation
pillar: plane
hypothesis: H3
evidence:
  - research/configs/l3-pilot.json
  - "make run CONFIG=research/configs/l3-pilot.json COUNT=1"
supersedes: none
---

**What.** The live L3 pilot makes 51 model calls: 17 per seed over seeds 1 to 3, 36 for contradiction and 15 for unsupported-claim.

**Why.** The key and spend ceiling are the lead's; the count sizes the request.

**Result.** `make run CONFIG=research/configs/l3-pilot.json COUNT=1` prints "calls: 51 = 17 per seed x 3 seeds (1, 2, 3)" and 12,178 prompt characters per seed across the four fixtures, each named by its sha256; no model called.

**Consequence.** At about 4 characters per token the pilot sends about 9,100 input tokens in all and at most 13,056 output tokens (51 x 256): a small cost on any candidate model.
