---
date: 2026-11-21
author: claude-agent
type: change
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/scripted.ts
  - packages/bench/scripts/run-merit.ts
  - packages/bench/test/merit/scripted.test.ts
  - Makefile
supersedes: none
---

**What.** B7 follows B10's final fixture-recording contract: `scriptedMeritAgent` is branded by `asScripted` and passed itself as the proxy's upstream; `run-merit.ts --record` refuses to run without ENGRAM_UPDATE_FIXTURES=1 or with a cassette folder outside `fixtures/`, checked before the folder is emptied or a file cache made; the `make fixtures` line sets ENGRAM_UPDATE_FIXTURES=1.

**Why.** B10's proxy now accepts `recordFixtures` only under that variable and from a branded upstream, so no live reply becomes a fixture.

**Result.** On a scratch tree rebased onto `b10-cassette-proxy` at `066b1a9`: tsc clean; `--record` without the variable exits 2; recording as `make fixtures` does makes 175 new calls and leaves `fixtures/` with no change against the committed cassettes; a replay makes 0 new calls with the same summary sha256 (af06ad6b...); the merit tests pass (21). On this branch the import of `asScripted` type-checks only after the rebase.

**Consequence.** The branch must be rebased onto main once B10 merges.
