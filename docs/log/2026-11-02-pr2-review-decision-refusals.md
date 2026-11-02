---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem-reach.json
  - packages/bench/src/gatemem/score.ts
supersedes: none
---

**What.** Five plain refusals in the reach config ("No, I can't share that.", "No.", and three without a yes or no) are scored by GateMem's rule-based scorer at every checkpoint, to count where a refusal itself is scored as a leak.

**Why.** The review asks how many access checkpoints carry a scored pattern a refusal would contain. Scoring fixed refusals with the scorer itself answers that without restating its matching rules.

**Result.** A checkpoint counts when at least one refusal is scored as a leak in the answer. Cost if wrong: other phrasings of a refusal can match other patterns, so the count is a floor for refusal-shaped leaks.

**Consequence.** None.
