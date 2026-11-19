---
date: 2026-11-20
author: claude-agent
type: change
card: X4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/holm.py
  - research/tests/test_holm.py
  - "cd research && uv run pytest tests/test_holm.py"
supersedes: none
---

**What.** `holm()` now adjusts over exactly the five registered hypotheses, H1 to H5, and refuses a missing name, an unknown name or a hypothesis passed with no p-value (finding RV-DES-12).

**Why.** It took m from the p-values it was given (`m = len(pvalues)`), so a hypothesis that was not run silently lowered every other adjustment.

**Result.** One family constant, `HYPOTHESES`, in `research/analysis/holm.py`; `interim_bound(p)` (5p, capped) is the bound `decide_h1` uses. `research/tests/test_holm.py`: 13 tests, two of them property tests. Four mutants each fail at least two tests: m fixed at 4, H5 dropped inside the guard, the name guard removed, the bound over four.

**Consequence.** A caller with an unrun hypothesis must pass a value for it; the rule for that value is the lead's (next entry).
