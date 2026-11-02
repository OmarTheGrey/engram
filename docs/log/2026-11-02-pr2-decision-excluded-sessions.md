---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/analysis/bootstrap.py
supersedes: none
---

**What.** An excluded session (violation null in the results file) counts for nothing: the item's mean is over its remaining seeds, and an item with no remaining seed under a condition leaves every contrast with that condition.

**Why.** MEM-INV-Bench scores a truncated or filtered reply as EXCLUDED or FILTERED (ADR 0029, review R6-5), and a failed GateMem judge call has no verdict; the pre-registration does not say how either enters the analysis.

**Result.** `item_means` skips null outcomes; `paired_differences` pairs items present under both conditions; the H1 table reports the excluded count per condition. Cost if wrong: if exclusions depend on the condition (a model refusing more under one), dropping them biases the contrast, which the reported counts let a reader see.

**Consequence.** PR 4 states the rule in v1's Statistics section.
