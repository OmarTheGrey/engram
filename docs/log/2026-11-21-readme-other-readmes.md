---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/README.md
  - docs/README.md
  - specs/README.md
  - docs/compliance/README.md
  - docs/readings/README.md
  - "uv run pytest research/tests/test_crosswalk.py"
supersedes: none
---

**What.** New `research/README.md` and `docs/README.md`; a link back to the root README in `specs/README.md` and `docs/compliance/README.md`; the stale frontier line of `docs/readings/README.md` refreshed.

**Why.** An examiner needs one page on how a result is made real and reproduced, and a reader of `docs/` needs a map; the readings page still dated the frontier summary to October only.

**Result.** The research README's reproduce example was run: `cost_table.py` regenerated `research/results/h2-cost-table.json` with sha256 `074d4fb0...`, the hash of its MANIFEST row. The compliance link sits after the opening paragraph, which its test reads; `test_crosswalk.py` passed, 125 tests. `docs/decisions/README.md` and `docs/research/absorb/README.md` were current and left alone.

**Consequence.** None beyond keeping these pages current.
