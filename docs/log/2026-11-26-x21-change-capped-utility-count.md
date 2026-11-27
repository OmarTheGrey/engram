---
date: 2026-11-26
author: claude-agent
type: change
card: X21
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - packages/runner/src/research/h1-sessions.ts
  - research/tests/test_h1_exclusions.py
  - packages/runner/test/research/h1-sessions.test.ts
  - uv run pytest research/tests/test_h1_exclusions.py research/tests/test_h1_pipeline.py research/tests/test_h1_secondary.py
  - make test-one T=packages/runner/test/research/h1-sessions.test.ts
supersedes: none
---

**What.** The H1 converter writes `capped: true` on a GateMem utility session the turn limit cut off, and every rate of the H1 table reports `capped_utility`, those sessions per arm and condition, zero included, beside `exclusions`.

**Why.** Pre-tag condition 3 and lead-decisions item 15, row (a): a capped utility session reached the table as a null `utility_ok`, indistinguishable from a judge with no verdict, so U lost it silently.

**Result.** The acceptance's pytest files pass (18 tests), the converter test file passes (32 tests). A table built with the capped flags equals the table built without them in everything but `capped_utility`: MGS's U, A and F, every rate, contrast and decision (`test_the_table_counts_the_capped_utility_sessions_per_arm_and_condition`).

**Consequence.** H1's read-out shows how many utility sessions left U under the cap. The pipeline test's rate expectations carry the new key and nothing else.
