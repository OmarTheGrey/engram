---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/analysis/power.py
  - docs/log/2026-11-02-pr2-r2-change-h4-power.md
supersedes: none
---

**What.** Review finding R2-5: the first round-two power run simulated every item and draw, was far too slow at large sizes, and was stopped unfinished.

**Why.** Each simulated study drew items times seeds uniforms per arm, so the cells needing tens of thousands of items per arm did not finish. It was stopped by the two process ids it had started, as the coordinator's rule after round one requires, not by image name.

**Result.** Commit 630aa7b draws a study as one multinomial of the items' joint states (`item_states`), at a cost that does not grow with the size; a test checks it against simulating every item. No result of the stopped run was kept.

**Consequence.** None.
