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
supersedes: docs/log/2026-11-19-l4-finding-live-count.md
---

**What.** The live model-lint run on the full set makes 95,217 calls, 31,739 per seed at seeds 1 to 3, 23,800,493 prompt characters per seed (`model_run`).

**Why.** The lead needs the size before supplying a key and a spend ceiling.

**Result.** It is expensive because 26,739 of the 28,739 contradiction calls per seed concern no label: L3 pairs each item with five neighbours. A subset departs from H3's stopping rule, so needs an amendment first, and `questions` takes only an explicit list (no seeded sampler). The reviewer's table, half-widths of a per-subtype recall over one fault per question: 100 questions, about 19,000 calls, 0.098 at p 0.5, 0.078 at p 0.8; 150, about 28,600, 0.080, 0.064; 250, about 47,600, 0.062, 0.050; 500, 95,217, 0.044, 0.035.

**Consequence.** The run's size is the lead's.
