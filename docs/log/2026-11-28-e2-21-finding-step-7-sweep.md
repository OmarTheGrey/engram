---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.21
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/read.test.ts
  - packages/core/test/unit/plane/read-by-id.test.ts
  - packages/adapters/test/plane/grants-files.test.ts
  - make test-one T=packages/core/test/unit/plane/grants.test.ts
supersedes: none
---

**What.** Every test file the card's step 7 lists, run with the option on in both profiles.

**Why.** The card requires each to pass unchanged or be changed on purpose.

**Result.** Core, 16 files in one run (grants, offboard, offboard-edges, crash-windows, the three cross-handle files, dogfood-cross-handle, knowledge, read, read-by-id, evaluate, oracle, presets, property grants and cedar): 489 passed. Adapters, the five listed: 26 passed. `visible-events`: 4 passed; `make test-invariants` (invariants, stateful, chain): 21 passed; `oracle-grants`: 19; `dogfood-report`: 51; UI `twin` and `view`: 38. The read filter's tests that seed an expired grant or one of another class on a first write run under `testPolicy()`, which leaves the option absent, so they keep today's behaviour unchanged, as the card expected. The twin workspace and the two-handle walk write only grants inside the cap.

**Consequence.** Only the four files of the change entry changed.
