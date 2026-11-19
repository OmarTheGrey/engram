---
date: 2026-11-19
author: claude-agent
type: finding
card: L4
chapter: evaluation
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-floor.json
  - research/configs/h3-lint-model.json
  - "make run CONFIG=research/configs/h3-lint-model.json COUNT=1"
supersedes: none
---

**What.** The live model-lint run on the full set makes 95,217 calls: 31,739 per seed at seeds 1 to 3 (`model_run` in the result).

**Why.** The lead needs the size before supplying a key and a spend ceiling.

**Result.** Per seed: 28,739 contradiction calls and 3,000 unsupported-claim calls, 23,800,493 prompt characters. Only 2,000 of the contradiction calls and 1,000 of the claim calls are labelled units; L3's five-neighbour pairing sends 26,739 pairs per seed that no label is about, and every one of the 3,000 labelled units is planned.

**Consequence.** For the lead: run the full set, or a seeded subset of questions. A subset is a config change (`questions`), not code; neither is decided here.
