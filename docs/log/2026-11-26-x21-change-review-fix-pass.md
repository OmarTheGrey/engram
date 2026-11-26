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
  - research/tests/test_h1_exclusions.py
  - research/tests/test_h1_pipeline.py
  - packages/runner/test/research/h1-sessions.test.ts
  - uv run pytest research/tests/test_h1_exclusions.py research/tests/test_h1_pipeline.py research/tests/test_h1_secondary.py
supersedes: none
---

**What.** The fix pass for X21's review (0 critical, 0 high, 3 medium, 5 low). The table also writes `capped_utility` in `mgs`. A converter test pins that only the turn limit marks a session capped. The planted CLI run carries one capped utility session end to end. `CAPPED_RUN` adds a second store, a second model, a `capped: false` row and forgetting rows, and its test checks the secondary sets and the sensitivity table.

**Why.** Six of the reviewer's mutants survived: M1, M3, M4, M5, M7 and T1.

**Result.** All six are now killed, each restored: M1, M5 and M7 fail 2 tests, M3, M4 and T1 fail 1. With `cappedOf` forced to false, the planted pipeline test fails too. Tests: 9 in exclusions, 33 in the converter file.

**Consequence.** The squash and the pre-registration sentence are left to the coordinator and X20.
