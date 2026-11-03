---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_h1_evidence.py
  - research/scripts/h1_cost.py
supersedes: none
---

**What.** The cost table's Python tests were written before `research/scripts/h1_cost.py` but not run until the script existed, so they were never seen failing.

**Why.** The script was written straight after the tests in one pass; the convention asks the failing run to be seen.

**Result.** Closed by mutation after the commit: making extra read turns not carry the session so far failed `test_a_session_s_tokens_grow_with_each_extra_read_turn`, and billing reasoning to every model failed `test_a_price_is_per_million_tokens_and_reasoning_is_output`; each file was restored by copy. The TypeScript shape tests were seen failing on the missing module first.

**Consequence.** None for the result; the remaining deliverables run each new test before writing the code.
