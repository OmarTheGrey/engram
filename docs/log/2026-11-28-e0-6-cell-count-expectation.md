---
date: 2026-11-28
author: claude-agent
type: failure
card: E0.6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/check-absorbed.test.ts
  - "make test-one T=scripts/test/check-absorbed.test.ts"
supersedes: none
---

**What.** The first run after implementing failed: the red row with an unescaped pipe was expected to split into 9 cells and split into 11.

**Why.** `min(2, |A|, |B|)` holds four pipes, not two; the expectation was counted wrong when written.

**Result.** The expectation now says 11, the count the parser gives. The same run showed main's register failing at its row 29 for the same reason (see the finding entry).

**Consequence.** Nothing beyond the fix.
