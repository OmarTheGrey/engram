---
date: 2026-11-22
author: claude-agent
type: decision
card: L7
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/configs/h3-lint-nli.json
  - research/configs/l3-lint-nli-fixture.json
  - research/configs/h3-lint-nli-fixture.json
supersedes: none
---

**What.** Froze the thresholds by a stated rule on card L3's two contradiction fixtures: upper 1, lower 0.1.

**Why.** P3 says the thresholds are set on L3's model fault fixtures and frozen before anything else is scored.

**Result.** Rule, on a 0.01 grid: the upper is the first step strictly above every pass-labelled pair, at least 0.9 and at most 1; the lower is the last step at or below every flag-labelled pair, at most 0.1. Highest pass 0.9961 gives upper 1; lowest flag 0.9996 gives lower 0.1. The report script derives them again and fails if a config differs.

**Consequence.** With upper 1 the flag band is empty in practice: on the fixture the tier only drops. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
