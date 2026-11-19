---
date: 2026-11-19
author: claude-agent
type: change
card: B6
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - research/configs/h2-longmemeval-c2.json
  - research/configs/h2-longmemeval-c5-medium.json
  - research/configs/b6-longmemeval-fixture.json
  - packages/runner/test/b6.test.ts
  - "make run CONFIG=research/configs/h2-longmemeval-c5-medium.json COUNT=1"
supersedes: none
---

**What.** LongMemEval's ungoverned (C2) and enforced (C5, preset medium) baselines on the cleaned S split are experiment configs that run live, replayed or counted, and a fixture-size config replays B5's cassettes.

**Why.** H2's primary test is C2 minus C5 at medium on LongMemEval on M1; card B6 builds its baseline. Before, the runner refused every LongMemEval experiment, COUNT and live run, and loaded only a fixture directory.

**Result.** The loader reads the S split's JSON file and checks it by its pinned sha256 (`LONGMEMEVAL_S`); COUNT gives each config 500 questions, 1,500 sessions and 1,500 judge calls (one per session, as evaluate_qa.py); a live run records reader and judge calls, seeded, and replays them (faux provider test); `b6-longmemeval-fixture` replays 24 calls from `fixtures/cassettes/b5-longmemeval-plane` with 0 new.

**Consequence.** The live baselines are the lead's step after the tag, once M1 is named and the key supplied.
