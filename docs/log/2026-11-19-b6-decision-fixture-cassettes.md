---
date: 2026-11-19
author: claude-agent
type: decision
card: B6
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - research/configs/b6-longmemeval-fixture.json
  - fixtures/cassettes/b5-longmemeval-plane
supersedes: none
---

**What.** The fixture-size config replays B5's committed cassettes instead of recording new ones.

**Why.** The task allows recording only by `make fixtures` and only when no cassette fits; B5 recorded C2 and C5 at medium on fake, Mem0 and Letta for four questions at seed 1, and a cache key names no config.

**Result.** `b6-longmemeval-fixture` is the experiment's shape (C2 and C5, medium, Mem0, read limit 20) at seed 1 on those four questions: 8 sessions, 24 calls replayed, 0 new (`packages/runner/test/b6.test.ts`). No fixture changed.

**Consequence.** Seeds 2 and 3 have no fixture cassette; a fixture with three seeds would need `make fixtures`.
