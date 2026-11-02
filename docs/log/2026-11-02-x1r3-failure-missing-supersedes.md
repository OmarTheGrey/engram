---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-02-x1r3-reads-never-search.md
supersedes: none
---

**What.** Two earlier entries still said the store answers a query with terms (`x1-empty-query-lists-all`, `x1-c4-retrieval-shared`), after round 2 made every condition use core's pipeline.

**Why.** Round 2 superseded the entries it rewrote, not the ones its change made false.

**Result.** `x1r3-reads-never-search` and `x1r3-c4-walk` supersede them.

**Consequence.** Found by the third review of PR #25 and fixed in its round-3 fix pass.
