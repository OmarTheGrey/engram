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
  - docs/research/results.html
  - "make lint"
supersedes: none
---

**What.** `make lint` failed after the review fixes: biome's `noDescendingSpecificity` warned on the generated page's CSS, and the lint runs with `--error-on-warnings`.

**Why.** Biome checks `docs/research/results.html` too. The new rule `td.path code` came after the more specific `#manifest-table td:nth-child(4) code`, both styling `code`.

**Result.** Moving `td.path code` above the manifest rules clears it; `make lint` passes (ruff, mypy on 95 files, biome with one unrelated info).

**Consequence.** The page's CSS is linted like source: a later edit to `CSS` in the script runs `make lint` after `make results-page`.
