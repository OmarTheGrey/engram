---
date: 2026-11-21
author: claude-agent
type: decision
card: R4
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Every claim the crosswalk marks not evidenced has a backlog row in "Follow-ups from card R4", and so does the missing results glob; C30's row is restated as a feature to build before a test.

**Why.** The review asked for rows for C48 and C50, and noted that C30's said a test "can be written" when no reinstatement surface exists to test. C48 waits for card D3 and a schema change, C50 for the dogfood, so their rows name what unblocks them rather than a test to write. C44's row said the claim "holds by review", which `Date.now()` in the Postgres transport contradicts.

**Result.** Five rows: C30, C44, C48, C50, and a pre-registration glob for results outside the hypotheses.

**Consequence.** The lead sees each gap with what closes it.
