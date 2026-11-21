---
date: 2026-11-21
author: claude-agent
type: change
card: B11
chapter: implementation
pillar: research
hypothesis: H5
evidence:
  - packages/bench/src/tau2/plane.ts
  - packages/bench/src/tau2/result.ts
  - packages/bench/test/tau2/plane.test.ts
  - packages/bench/test/tau2/result.test.ts
  - fixtures/tau2/expected-results.jsonl
  - "make bench BENCH=tau2"
supersedes: none
---

**What.** The review fix pass, B11-1 to B11-12. C5 is `engram serve`'s app in process: core retrieval with the read limit, the clock fixed at memory_time, seeded ids, read_id back in its tag. Rows name `db_reward` and `tau2_reward` (ALL, judge routed). Failures are caught per task, rows written as tasks end. The timeout is configurable. Keys are stripped, OpenAI URLs dead, `-X utf8`. Item ids come from a write counter. `checkTau2` checks Python 3.12, tau2 1.0.1, the lock and `.env` files.

**Why.** As built, C5 minus C2 measured retrieval and the clock, not governance.

**Result.** 37 tests in 8 tau2 files pass. Two `make bench BENCH=tau2` runs made 0 new calls, matched the expected results and were byte-identical (results sha256 `5b17086242c05e02`). Mutations: `db_reward: 1` failed 2 tests and exited make 2; dropping the core read failed the plane test.

**Consequence.** C5 is the runner's C5.
