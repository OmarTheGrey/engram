---
date: 2026-11-28
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/consolidate_log.py
  - "make thesis"
  - research/thesis/drafts/results-index.md
supersedes: none
---

**What.** `make thesis` on b30cdffd refused to write any draft: 20 entries of `type: measurement` broke the measurement rules, so the drafts under `research/thesis/drafts/` were last committed on 2026-10-22 (27261e6f).

**Why.** Seven were gate or model checks typed as measurements with no results file or config (two of E1.5, E9.9, L8, R5, R6, X20); eleven named the config only inside a command string; two cited `research/results/h2-perf-budget-samples.jsonl`, which is not a MANIFEST row. `make lint-docs` does not check a measurement's results file or config, so no gate caught them. Six were already superseded, but the script held superseded entries to the same rules, so rule 5's only correction could not clear them.

**Result.** The script now skips the measurement rules for a superseded entry (tested in `research/tests/test_consolidate.py`), and fourteen 2026-11-28 entries supersede the other fourteen.

**Consequence.** A measurement with no bare config path still fails `make thesis`, not `make lint-docs`.
