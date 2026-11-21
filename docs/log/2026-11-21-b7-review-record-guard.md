---
date: 2026-11-21
author: claude-agent
type: change
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/config.ts
  - packages/bench/test/merit/record-guard.test.ts
  - "make test-one T=packages/bench/test/merit/record-guard.test.ts"
supersedes: none
---

**What.** Review finding B7-1: `run-merit.ts --record` checks `fixtureRecordingRefusal` (no ENGRAM_OFFLINE, ENGRAM_UPDATE_FIXTURES=1, a folder inside `fixtures/`) before it fetches, empties or creates anything.

**Why.** The guard ran after the checkout and environment setup, and nothing tested it.

**Result.** The test runs the script as a process: without the variable, and into a folder outside `fixtures/`, it exits 2 with a sentinel file still in the folder and no output folder made (3 tests pass). Its checkout is a folder git cannot read, so a guard that let the run through would exit 1 there, never fetch.

**Consequence.** None.
