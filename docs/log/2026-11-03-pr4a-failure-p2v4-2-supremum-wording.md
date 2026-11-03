---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/log/2026-11-02-pr2-r3-finding-h4-power.md
  - docs/log/2026-11-02-pr2-r3-measurement-h4-power.md
  - docs/conventions/testing.md
  - research/analysis/equivalence.py
  - research/analysis/power.py
supersedes: none
---

**What.** PR #26 called a search result an exact level over the composite null: "the TOST's exact level over the composite null" (round-3 finding), "Largest composite-null level" (round-3 measurement), "its exact level over the composite null" (`docs/conventions/testing.md`), "every null distribution the three-seed design allows" (`equivalence.py`, and `power.py`'s `_composite_sup`).

**Why.** Each level the search visits is exact, but the maximum over distributions is numerical, and only the boundary |mean| = margin is searched; the interior is not argued, and independent, identically distributed items are assumed. Found by PR #26's final verification (P2v4-2).

**Result.** The two entries are superseded (`2026-11-03-pr4a-finding-h4-power`, `2026-11-03-pr4a-measurement-h4-power`); the convention and the two docstrings are fixed in place, since they are not log entries.

**Consequence.** v1 should call these "the largest level a search found".
