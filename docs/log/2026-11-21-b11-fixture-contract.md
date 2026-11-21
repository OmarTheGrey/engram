---
date: 2026-11-21
author: claude-agent
type: change
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/tau2/scripted.ts
  - packages/bench/scripts/run-tau2.ts
  - packages/bench/test/tau2/scripted.test.ts
  - Makefile
supersedes: none
---

**What.** B11 adapted to B10's final fixture-recording contract (`066b1a9`). The scripted agent and user simulator are branded with `asScripted`, and the proxy gets the branded functions themselves. `--record` needs `ENGRAM_UPDATE_FIXTURES=1`, which both `make fixtures` lines set, and writes only inside `fixtures/`. Every other run checks its recording folder with `recordingRefusal` before a file cache creates it. The config's model check is renamed `isScriptedModel`, so it does not shadow `@engram/model`'s `isScripted`.

**Why.** B10's proxy now records fixture cassettes only from a branded upstream, and only under that variable.

**Result.** The check ran on a scratch copy of this branch rebased onto `b10-cassette-proxy`. tsc is clean and 28 tests pass. `--record` without the variable is refused; with it, it records 62 calls whose cassettes equal the committed ones byte for byte. Two `make bench BENCH=tau2` runs each made 0 new calls, results sha256 `5f8c12f8`.

**Consequence.** This branch type-checks only after it is rebased onto B10's final change.
