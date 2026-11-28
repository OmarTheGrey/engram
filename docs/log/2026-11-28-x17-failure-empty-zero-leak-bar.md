---
date: 2026-11-28
author: claude-agent
type: failure
card: X17
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/results_page.py
  - research/configs/results-register.json
  - docs/research/results.html
supersedes: none
---

**What.** The first page drew the leakage proof of concept's bar empty, and printed the register's backtick markup raw in notes and needs.

**Why.** The meter filled its bar with the part, and for a zero-leak count the part is zero; prose was HTML-escaped without turning the register's code spans into code elements. Both showed only in Chromium screenshots of the page, light and dark, at 1200 and 390 pixels.

**Result.** A meter may name a `complement`: the bar then fills with whole minus part and the text reads "2,188 of 2,188 probes leaked nothing; 0 leaked a canary", both numbers read from the file. Code spans render as code. The manifest table scrolls inside its own box on a phone instead of wrapping each cell a letter at a time. Tests pin both meter forms.

**Consequence.** None beyond the fix; the screenshots were scratch files, not committed.
