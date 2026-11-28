---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/model/replay.ts
  - packages/core/test/model/trace-replay.test.ts
supersedes: none
---

**What.** A diverging trace is explained by the first finding whose mark it carries, checked up to the step it diverges at; one with no mark is unexplained and fails the test and the results script.

**Why.** The card makes every mismatch that is not a known gap a finding with a pinned test, never a fix.

**Result.** Seven findings, each with a scenario in `specs/replay.qnt` pinned at its step; the 200 traces' outcomes are pinned to the results file.

**Consequence.** Cost if wrong: a new divergence in a trace that also carries a mark is attributed to that mark; the per-trace pin still flags any change.
