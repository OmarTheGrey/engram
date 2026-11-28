---
date: 2026-11-28
author: claude-agent
type: change
card: D4
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/runner/src/replay-validate.ts
  - research/configs/d4-drift-fixture.json
  - fixtures/distill/d4-drift/tasks.json
  - fixtures/distill/d4-drift/revalidation.json
  - fixtures/cassettes/d4-drift-fixture
  - packages/runner/test/d4-drift.test.ts
supersedes: none
---

**What.** The runner's drift config: D3's admission rerun from D3's cassettes, the admitted procedure re-validated on a pool where one held-out task changed, then on D3's pool, each presented to `Plane.revalidate`.

**Why.** Card D4 steps 1 and 3: a fixture with a changed task, the replay validator reused, every call seeded and cached.

**Result.** The helper in `synthetic/remove-dead-code-15` gained an argument, so the procedure's edit finds nothing (0 of 3 seeds). Unchanged tasks replay from D3's cassettes, read only (a write there throws); the changed task's 15 calls are in `fixtures/cassettes/d4-drift-fixture`. Replayed: "model calls: 0 new, 508 from cassettes", drift retired, restore active. A recording replays itself before writing the core fixture, so the fixture's calls are a replay's. D3's fixtures and cassettes are untouched. `make fixtures` records it after D3.

**Consequence.** The core acceptance test reads the fixture; the runner test requires the same bytes.
