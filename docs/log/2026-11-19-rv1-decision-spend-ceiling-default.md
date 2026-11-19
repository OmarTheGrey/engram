---
date: 2026-11-19
author: claude-agent
type: decision
card: RV1
chapter: design
pillar: research
hypothesis: H2
evidence:
  - packages/runner/src/config.ts
  - research/results/h1-cost.json
  - research/results/h2-longmemeval-cost.json
supersedes: none
---

**What.** Proposed for the lead: one ceiling per config, applied to each provider separately, unset in every pipeline config, and in each experiment config set at the tag to 1.25 times the high estimate of that run's cost for the named model (`research/results/h1-cost.json`, `research/results/h2-longmemeval-cost.json`).

**Why.** H2's stopping rule names a per-provider ceiling without a value, and the models (decision sheet item 1) and so the prices are still open. A ceiling tied to the high estimate stops a run that costs far more than planned, a symptom of a fault, and lets a run within its estimate finish.

**Result.** The mechanism checks before each session, so a run can pass the ceiling by one session's cost; the stop is reported in summary.json and the completed sessions are the subset H2 reports. No experiment config is edited here.

**Consequence.** The lead sets the value, or another rule, before the tag.
