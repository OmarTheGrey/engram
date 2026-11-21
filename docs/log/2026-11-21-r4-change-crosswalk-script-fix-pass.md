---
date: 2026-11-21
author: claude-agent
type: change
card: R4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/crosswalk.py
  - research/tests/test_crosswalk.py
  - "uv run pytest -q research/tests/test_crosswalk.py"
supersedes: docs/log/2026-11-21-r4-change-crosswalk-script.md
---

**What.** `research/scripts/crosswalk.py` reads test files by brackets: `scan` blanks comments, string bodies and regular expression literals, then pairs brackets; titles of `.each` and `.for` rows are formatted as vitest formats them; a test is evidence only when nothing skips it and no block but a describe encloses it, unless its row says why it runs.

**Why.** The review's probes showed the indentation reader counting tests in comments, strings, skipped or conditional blocks and `if (false)`, and 42 of 70 `.each` calls unresolved.

**Result.** Every probe is refused (`test_no_review_probe_counts_as_evidence`); 70 of the 71 `.each` and `.for` calls over an array literal resolve, and 84 of 111 in all, the rest built in code. The wording ban matches whole words of every stem in rows, statement, method and README prose. 125 tests pass.

**Consequence.** A test the crosswalk names must be one vitest would run, not only one it could find.
