---
date: 2026-11-21
author: claude-agent
type: failure
card: R4
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - research/tests/test_crosswalk.py
  - "uv run pytest -q research/tests/test_crosswalk.py -k probe"
supersedes: none
---

**What.** The first parser counted tests that never run as evidence, and could not read most `.each` titles.

**Why.** It matched call text anywhere, in comments and strings included. It read nesting from indentation and checked only the describes a row named, so a skipped describe it did not name, `.skipIf`, an options `skip`, and `if (false)` went unseen. It read `.each` only over string lists with one `%s`, missing `] as const)`, `%i`, `$key` rows and `.for`.

**Result.** The independent review's probes showed each case. The bracket scanner of the fix pass refuses all 19 probes in `research/tests/test_crosswalk.py`, and mutants removing comment skipping, single-quoted strings, describe skips, enclosure, options and conditions each fail a test.

**Consequence.** No committed row named a test the old parser wrongly accepted: all 97 earlier tests pass the new rules, six of them once marked enclosed.
