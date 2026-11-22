---
date: 2026-11-21
author: claude-agent
type: milestone
card: L5
chapter: evaluation
pillar: research
hypothesis: H3
evidence:
  - research/results/MANIFEST.md
  - "make test-repro"
  - "ENGRAM_RESEARCH_WORKERS=2 uv run python research/scripts/reproduce.py"
supersedes: none
---

**What.** Review finding L5-9: `make test-repro` ran once over the fix pass, with a 90-minute timeout, and the rows it could touch were checked again with `check_row` after the merge of main at 65ce8b66.

**Why.** No committed result may move with card L5 merged, and the card's own row must reproduce.

**Result.** "test-repro: 21 of 22 results reproduce": every row but h4-power, whose worker pool ran out of memory under the load of other agents ("Unable to allocate 4.61 MiB"), a failure of the machine, not of a hash. After the merge, `check_row` reproduced h3-fault-set (a274701d), h3-lint-floor (354da571) and h3-near-duplicate (76bd5a0b), and, with ENGRAM_RESEARCH_WORKERS=2, h4-power (852a6776).

**Consequence.** Every MANIFEST row reproduces; none moved.
