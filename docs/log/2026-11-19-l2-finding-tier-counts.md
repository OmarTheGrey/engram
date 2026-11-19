---
date: 2026-11-19
author: claude-agent
type: finding
card: L2
chapter: discussion
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-fault-set.json
  - packages/bench/src/faults/reach.ts
supersedes: none
---

**What.** What each lint tier can find in H3's fault set under card L3's rules.

**Why.** The coordinator asked what each tier can find, and which of L3's rules the set cannot meet.

**Result.** From `research/results/h3-fault-set.json`, `by_tier`: stale, 500 by the model tier (superseded) and 1,000 by the deterministic tier only; contradictory, 500 by the model tier and none by the deterministic; misplaced, 500 by the deterministic tier only and 500 by neither (wrong-scope); unsupported, 500 by the model tier (unsupported-claim) and 1,000 by the deterministic tier only. In total 1,500 model, 2,500 deterministic only, 500 neither; `label_check` confirms all 1,500 model-tier faults are units L3 sends.

**Consequence.** The set cannot meet two of L3's rules: no contradiction is keyed, and a superseded statement cannot be the later id of its pair, so its finding lands on the update (`finding_on`).
