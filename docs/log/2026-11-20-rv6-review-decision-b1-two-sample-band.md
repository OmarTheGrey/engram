---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/research/check-runs.ts
  - "node packages/runner/scripts/check-runs.ts b1-band"
supersedes: docs/log/2026-11-20-rv6-decision-b1-tolerance.md
---

**What.** Proposed for the lead: B1 passes when, per metric, Newcombe's hybrid score interval (Wilson on each side, 95 percent) for the replicated rate on 50 checkpoints minus the paper's rate reaches within 3 points of zero.

**Why.** It carries both samples' error; Wilson's interval stays inside [0, 1] and is not empty at 0. The paper's counts are its rates over the pinned Medical domain's 210 utility, 192 access and 177 forgetting checkpoints (192, 20 and 4, which round to the published 91.4, 10.4 and 2.3).

**Result.** Of 50 replicated checkpoints per kind: U passes at 40 to 50 (80 to 100 percent), A at 0 to 12 (0 to 24), F at 0 to 6 (0 to 12), from `check-runs.ts b1-band`.

**Consequence.** The lead accepts or changes it before the B1 run.
