---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/analysis/power.py
  - research/configs/h4-power.json
supersedes: docs/log/2026-11-02-pr2-decision-power-model.md
---

**What.** H4's simulation draws each session from shared or own uniform draws (shared with probability 1 - kappa), each arm violating below its own rate, and reports sizes for one, two and four families jointly at 80 percent power.

**Why.** Uniform draws give arms at equal rates the earlier model's discordance and give arms a margin apart a coupled null for the level check. Families (stores and models, on two benchmarks) are assumed to pass independently, so each needs 0.8^(1/k); a store family and a model family are the same three exchangeable arms here, so one table serves both.

**Result.** The grid keeps kappa 1 and 0.25 and drops 0.5 to bound `make test-repro`'s time; size scales linearly in kappa. Cost if wrong: correlated families make joint power higher than the product.

**Consequence.** PR 4 reads kappa per family.
