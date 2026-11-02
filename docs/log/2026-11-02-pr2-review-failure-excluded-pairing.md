---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/analysis/bootstrap.py
  - research/analysis/h1.py
supersedes: docs/log/2026-11-02-pr2-decision-excluded-sessions.md
---

**What.** Review finding P2-9: an excluded session broke the pairing on the same seed.

**Why.** The H1 table averaged each condition over its own remaining seeds, so an item's C4 mean over seeds 1, 2 and 3 was compared with its C5 mean over seeds 1 and 3, against the pre-registration's pairing on item, model and seed.

**Result.** `paired_item_differences` drops an (item, seed) from both conditions when either excluded or lacks it, the contrast reports how many it dropped, and a test plants such a session (mutation M9, the old pairing, is killed).

**Consequence.** This entry supersedes the excluded-sessions decision of the same day.
