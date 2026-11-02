---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/configs/h4-power.json
  - docs/log/2026-11-02-pr2-r2-decision-level-gate.md
supersedes: none
---

**What.** Review finding R2-5: at alpha 0.01 the round-two level gate first ran 4,000 simulations per check, so Monte Carlo noise decided which sizes passed.

**Why.** Two standard errors at 4,000 runs are 0.0031, so the gate admitted a measured level up to about 0.0069; levels at the candidate sizes sat near 0.0065, and the walk climbed to sizes whose power was 1. Commit 473e132 raised the runs to 20,000 (a gate of 0.0086) without an entry saying why.

**Result.** Round three removes simulation from the gate: every level checked is computed exactly (decision entry `pr2-r3-decision-level-gate`).

**Consequence.** The 4,000-run table was never committed as a result.
