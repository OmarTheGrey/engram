---
date: 2026-11-28
author: claude-agent
type: finding
card: E0.7
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - scripts/test/offline-guard.ts
  - scripts/test/offline-guard.test.ts
  - docs/conventions/testing.md
supersedes: docs/log/2026-11-28-e0-7-finding-no-test-needs-network.md
---

**What.** With the review's tighter guard on, every test project still passes under `ENGRAM_OFFLINE=1`. So no test reaches a host off this machine, uses a `.localhost` subname, passes its own `lookup` or opens a UNC path, and `PINNED_DATA_FETCH_TESTS` stays empty.

**Why.** The review fixes refuse more than the first guard did, and any of them could have broken a test that was offline in fact.

**Result.** Each project ran on its own as `ENGRAM_OFFLINE=1 pnpm exec vitest run --project <name>`. All sixteen exited 0: 7,020 passed, 44 skipped and 1 todo (scripts 500, core 3,161, cli 946). The e2e layer was not run.

**Consequence.** Still outside the guard: child processes, worker threads, `dgram` and pytest, as `docs/conventions/testing.md` states.
