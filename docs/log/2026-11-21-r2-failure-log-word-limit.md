---
date: 2026-11-21
author: claude-agent
type: failure
card: R2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - make lint-docs
  - scripts/check-log.ts
supersedes: none
---

**What.** `make lint-docs` failed on two of card R2's log entries on the first run.

**Why.** The bodies of `2026-11-21-r2-change-benchmark-intake.md` and `2026-11-21-r2-change-proposed-arms.md` had 151 and 152 words, and the limit is 150.

**Result.** Each was cut by a few words. The proposed-arms entry needed a second cut, since the first left it at 151, and `make lint-docs` then passed. No other entry was over.

**Consequence.** Nothing beyond the two edits.
