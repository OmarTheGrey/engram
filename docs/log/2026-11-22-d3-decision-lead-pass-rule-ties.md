---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/validate.ts
  - packages/core/test/unit/distill/validate.test.ts
  - docs/tasks/lead-decisions.md
supersedes: docs/log/2026-11-22-d3-decision-lead-pass-rule.md
---

**What.** The lead's rule of 2026-11-22, "5 tasks, no worse": a task passes when the candidate's mean reward over seeds 1 to 3 is at least 2/3 and not below the mean without it. Ties pass. Admit at 4 of 5 held-out tasks, drawn by the config's seed.

**Why.** The superseded entry said a refused "4 of 5 against 5 of 5" (k 0). The test it cited encodes a per-seed case: four tasks at 2 of 3 seeds with the candidate against 3 of 3 without. And the lead's stated meaning admits a skill that matches a strong baseline (review finding D3-14).

**Result.** Tests: that per-seed case is refused (k 0). Four tasks at 3/3 against 3/3, plus one at 0/3 against 3/3, is admitted at 4 of 5; five ties at 3/3 are admitted.

**Consequence.** The oracle pins ties too; the pooled-rate tests stand.
