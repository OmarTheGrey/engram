---
date: 2026-11-21
author: claude-agent
type: milestone
card: B7
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - research/configs/b7-merit-fixture.json
  - fixtures/cassettes/b7-merit-fixture
  - "make bench BENCH=merit"
supersedes: docs/log/2026-11-21-b7-fixture-slice.md
---

**What.** MERIT's fixture slice replays offline on main after card B10's merge: D1 easy, 2 arcs of world seed 0, 5 episodes each, C1 once, C2 and C5 on fake, mem0 and letta, model seed 1, 175 cassettes from the scripted agent.

**Why.** The earlier entry said world seeds 0 and 1; the two arcs are arcs 0 and 1 of world seed 0 (review finding B7-5), and the branch was rebased onto main.

**Result.** `make bench BENCH=merit`, twice: `model calls: 0 new, 175 from cassettes`; `cost: paid this run 0.000000 USD (0 input, 0 output tokens); recorded cost of the replayed calls 0.000000 USD (165799 input, 3848 output tokens)`. Both summaries sha256 af06ad6b..., both ledgers d8e24fbd...; `events.jsonl` in the 3 C5 cells only. Scripted, so not a result (rule 9).

**Consequence.** None.
