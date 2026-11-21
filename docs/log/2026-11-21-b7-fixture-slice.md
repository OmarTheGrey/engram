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
supersedes: none
---

**What.** MERIT's fixture slice replays offline: D1 easy, 2 arcs (world seeds 0 and 1) of 5 episodes, C1 once, C2 and C5 on fake, mem0 and letta, model seed 1, 175 committed cassettes recorded from the scripted agent.

**Why.** The card's acceptance: the slice replays twice, the second run with zero new calls, and the cost is in the output.

**Result.** `make bench BENCH=merit`, run twice: `model calls: 0 new, 175 from cassettes` both times; `cost: paid this run 0.000000 USD (0 input, 0 output tokens); recorded cost of the replayed calls 0.000000 USD (165799 input, 3848 output tokens)`. The two summaries and ledgers are byte-identical (summary sha256 af06ad6b462a2cf8...). Scripted, so not a result (rule 9).

**Consequence.** The tokens are the scripted agent's estimates; card X7 records real usage.
