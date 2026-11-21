---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/research/prereg-v1-decisions.md
  - "uv run pytest -q research/tests/test_prereg.py"
supersedes: none
---

**What.** Pre-registration v1 carries every answer of 2026-11-20, with a Versions row "v1 (answered, 2026-11-20)", still untagged.

**Why.** Card R2 edits the same file and waits for this card; the tag on 30 November needs the text whole.

**Result.** Before: items 1 and 20 marked recommended, M1 gpt-5.6-terra, H4 across stores, models and MemoryAgentBench, C7 tested, H2's and H5's thresholds proposed, H3's deterministic tier primary. After: no mark; the lead's three models; H4 across models on GateMem; C7 untested; thresholds confirmed; H3's model tier primary; ceilings, turn limit, exclusion counts, the pre-tag checks and dates. The header says only the label audit (23 to 28 November) comes before the tag. `test_prereg.py`: 10 passed.

**Consequence.** Card R2 may start. Three things in the text need code before the tag (items 14 and 15, `on_stop`); the backlog lists them.
