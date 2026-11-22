---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/tasks/lead-decisions.md
  - packages/core/src/distill/validate.ts
  - packages/core/test/unit/distill/validate.test.ts
supersedes: docs/log/2026-11-21-d3-decision-pass-rule.md
---

**What.** The lead answered review finding D3-1 on 2026-11-22: "5 tasks, no worse". A held-out task passes when the candidate's mean reward over the 3 seeds reaches the threshold and is not below the mean without it; n is 5 held-out tasks drawn by the config's seed; admit at 4 of 5.

**Why.** The registered "4 of 5 runs" left open what a run is and whether the baseline counts (lead-decisions item 63).

**Result.** `scoreReplay` compares sums over the same runs. Finding D3-7's tests pass: 4 of 5 with the candidate against 5 of 5 without is refused (k 0), and pooled 11 of 15 against 8 of 15 is refused at 3 tasks and admitted at 4. `make test-one T=packages/core/test/unit/distill/validate.test.ts`: 36 passed.

**Consequence.** ADR 0045 points 2 and 8 carry the rule. The oracle reads it in its own form.
