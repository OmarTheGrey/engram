---
date: 2026-11-28
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - "make thesis"
  - "make lint"
  - docs/log/2026-11-28-rr-decision-register-staleness.md
supersedes: none
---

**What.** In the review fix pass, `make thesis` refused twice and `make lint` once before both passed.

**Why.** The new decision entry's body ran to 154 and then 151 words, over the 150-word limit that `research/scripts/consolidate_log.py` enforces; and one line of the register script's new top-paragraph helper ran to 102 characters, over ruff's 100.

**Result.** The entry was cut to 147 words and the line rewritten; `make thesis`, `make results-register CHECK=1` and `make lint` then passed.

**Consequence.** Nothing beyond the record.
