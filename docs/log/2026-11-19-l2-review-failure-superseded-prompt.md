---
date: 2026-11-19
author: claude-agent
type: failure
card: L2
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/labels.ts
  - packages/core/src/lint/model.ts
supersedes: none
---

**What.** Review finding L2-4 on PR #46: the superseded label assumed that card L3's contradiction lint finds a supersession, which depends on how the model reads L3's prompt.

**Why.** L3's prompt asks whether two statements "cannot both be true at the same time"; an old value and a later one can be read as two states at different times, and so as consistent. The label did not say so.

**Result.** The superseded subtype's description, the fixture README and the result's `limits.superseded` now say that superseded recall measures how the model reads that prompt; a backlog row asks the lead or card L4 to decide whether the prompt should treat a later update as a contradiction. L3's prompt is unchanged.

**Consequence.** Superseded recall is reported apart from conflict recall.
