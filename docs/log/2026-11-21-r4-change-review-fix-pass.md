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
  - research/configs/crosswalk.json
  - research/tests/test_crosswalk.py
  - docs/compliance/README.md
  - "uv run pytest -q research/tests/test_crosswalk.py"
supersedes: docs/log/2026-11-21-r4-change-crosswalk-claims.md
---

**What.** The R4 review fix pass: seven important and four minor defects of the independent review fixed on branch `r4-crosswalk`, rebased onto main after R3, E2.7 and E2.8.

**Why.** The review found the Omnibus statement false, the text matching fooled seven ways, most `.each` titles invisible, C44 contradicted, links overreaching, the wording ban easily evaded and the paragraph boundary untested.

**Result.** The parser now scans brackets with comments and strings blanked; 50 claims, 46 evidenced by 105 named tests in 32 files, 4 not evidenced, 27 obligations, every quotation standing. C29 names its denial rows; C16, C17, C26, C43, C45 and C46 gained the tests for their missing halves; C44 is restated; four links say they are in tension. `research/tests/test_crosswalk.py` has 125 tests; 13 mutants of the script were each killed.

**Consequence.** The thesis table rests on the checked rules `docs/compliance/README.md` states.
