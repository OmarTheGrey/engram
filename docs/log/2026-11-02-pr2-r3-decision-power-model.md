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
  - research/results/h4-power.json
supersedes: docs/log/2026-11-02-pr2-review-decision-power-model.md
---

**What.** H4's simulation draws each session from shared or own uniform draws (shared with probability 1 - kappa), each arm violating below its own rate, and reports sizes for one, two and four families jointly at 80 percent power.

**Why.** Uniform draws give arms at equal rates the earlier model's discordance and arms a margin apart a coupled null. Families are assumed to pass independently, so each needs 0.8^(1/k); store and model families are the same three exchangeable arms here, so one table serves both.

**Result.** The grid keeps kappa 1 and 0.25, dropping 0.5 to bound `make test-repro`'s time. From kappa 0.25 to 1 the size grows 1.40 to 4.00 times at alpha 0.05, and 1.00 to 4.00 at alpha 0.01, where the composite null sets most sizes: not linearly. Cost if wrong: correlated families make joint power higher than the product.

**Consequence.** PR 4 reads kappa per family.
