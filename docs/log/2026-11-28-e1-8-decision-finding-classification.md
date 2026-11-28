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

**What.** A divergence is attributed to a finding only by a mark of that finding about an item the divergence is about, appended at or before the diverging step, for a kind of difference the finding can cause (`replay.ts` `attribute`, `KINDS`); the latest such mark wins. With none it is unexplained and fails the test and the results script.

**Why.** The card makes every mismatch that is not a known gap a finding with a pinned test, never a fix; the review found the first rule, any mark anywhere in the trace, misfiled replay-074.

**Result.** Eight findings, each with a scenario in `specs/replay.qnt` pinned at its step, and a unit test of the rule; the 200 traces' outcomes are pinned to the results file.

**Consequence.** Cost if wrong: a new divergence about an item an earlier mark names, of a kind that mark allows, is still filed under it; the per-trace pin flags any change.
