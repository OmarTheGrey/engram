---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - research/configs/perf-budget.json
  - research/tests/test_prereg.py
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-x15-decision-result-name-h2.md
---

**What.** The result keeps the file name `research/results/h2-perf-budget.json`, but its `hypothesis` field is now `none` and a `filed_under` field says it sits under `h2-*` only for the results glob.

**Why.** Review finding X15-4: the first entry assigned the result to H2, which it does not test. Card R4 (merged as #75) filed its crosswalk the same way, as `h1-crosswalk.json` with hypothesis `none`, and recorded the missing glob for results outside the hypotheses as a backlog row ("A results glob outside the hypotheses").

**Result.** `test_prereg.py` still maps the file to one glob; nothing claims it decides H2.

**Consequence.** When that backlog row is done, the file is renamed with its MANIFEST row.
