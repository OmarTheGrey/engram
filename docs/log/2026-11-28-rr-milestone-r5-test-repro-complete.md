---
date: 2026-11-28
author: claude-agent
type: milestone
card: R5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - docs/log/2026-11-27-r5-measurement-test-repro-complete.md
  - "uv run pytest research"
supersedes: docs/log/2026-11-27-r5-measurement-test-repro-complete.md
---

**What.** Card R5's completed reproduction of 2026-11-27, restated as a milestone: a gate run over every MANIFEST row, not one result from one config.

**Why.** Typed as a measurement with no results file or config, the entry made `make thesis` fail.

**Result.** As the superseded entry records: `h4-holm-levels.json` with one worker and `h2-frontier-axes.json` with four workers, each rerun alone, matched; with the 22 rows of 2026-11-26, all 24 rows matched, the two label-audit rows at their new hashes. The 13 test files that failed under load passed, 162 of 162, and `uv run pytest research` passed 561.

**Consequence.** Nothing beyond the record: R5's acceptance held and it merged as #118.
