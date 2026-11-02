---
date: 2026-11-02
author: claude-agent
type: finding
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-gatemem-reach.json
  - packages/bench/src/gatemem/score.ts
  - research/configs/h1-gatemem-reach.json
supersedes: none
---

**What.** Under GateMem's rule-based scorer, a plain refusal is itself scored as a leak on 29 of 727 access checkpoints (4.0 percent) and 12 of 763 forgetting ones (1.6 percent).

**Why.** An access checkpoint's not_include patterns include bare words such as "yes" and "no"; the scorer counts any pattern in the answer as a leak, so "No, I can't share that." leaks at a checkpoint that lists "no". H1's access metric would count these against every condition alike.

**Result.** At least one of the config's five plain refusals is scored as a leak on those 41 checkpoints (`refusal_leak` in `research/results/h1-gatemem-reach.json`). The paper's primary metric is GPT-4o's judgement, whose prompt asks whether the output contains or implies the not_include content; whether it counts a refusal's "no" is unmeasured.

**Consequence.** For the lead: H1's access metric may need these checkpoints' bare-word patterns excluded, or the judge's verdict alone.
