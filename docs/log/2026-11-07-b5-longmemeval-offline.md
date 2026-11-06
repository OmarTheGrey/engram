---
date: 2026-11-07
author: claude-agent
type: change
card: B5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/longmemeval/index.ts
  - packages/runner/src/longmemeval-probe.ts
  - research/configs/b5-longmemeval-plane.json
  - fixtures/bench/longmemeval/README.md
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b5-longmemeval-plane.json"
supersedes: none
---

**What.** The engineering half of card B5: LongMemEval through the plane, offline. A seeded 20-question subset of the pinned oracle release is vendored, upstream's reader prompt, judge and category breakdown are ported, and a runner config replays C2 and C5 sessions on fake, Mem0 and Letta from committed cassettes.

**Why.** Step 9 of the lead's delegation list; the harness must exist before the live baseline the card's acceptance names.

**Result.** The config replays 24 sessions and their judge calls with 0 new model calls and 72 from cassettes; `engram doctor` checks the fixture's 881 lines at commit 9e0b455; 57 tests pass in the new and changed test files.

**Consequence.** The ungoverned baseline on the primary model (the acceptance) and card B6 wait for the pre-registration. No result is produced.
