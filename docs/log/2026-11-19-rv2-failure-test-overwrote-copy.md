---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_h1_pipeline.py
  - "uv run pytest research/tests/test_h1_pipeline.py: 1 failed, 3 passed (the gate-by-action conversion exited 1)"
supersedes: none
---

**What.** My first version of the pipeline test failed in a way I did not expect: the gate-by-action conversion was refused.

**Why.** The refusal case for a dropped reply wrote its shortened copy to `filled-ben.json`, overwriting the reader's full copy. The later gate-by-action run then read the short copy and was rightly refused.

**Result.** The short copy now has its own file (`filled-ben-short.json`), and the test passes: 4 passed. The converter was right throughout.

**Consequence.** Nothing beyond the test. The failed run showed that the gate-by-action path applies the new refusal too.
