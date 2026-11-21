---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: evaluation
pillar: research
hypothesis: H5
evidence:
  - research/configs/b11-tau2-fixture.json
  - fixtures/tau2/script.json
  - fixtures/tau2/expected-results.jsonl
supersedes: docs/log/2026-11-21-b11-decision-fixture-slice.md
---

**What.** The fixture slice is airline test tasks 6, 19 and 16, seed 1, under C1, C2 and C5 at preset medium. Every task runs EvaluationType.ALL. The earlier entry said a retail run would use ENV; it now uses ALL as well, with the judge routed to its proxy. Airline calls no judge because its reward basis (DB and COMMUNICATE) has no NL assertion.

**Why.** Review B11-10. Airline's tau2 reward is fully deterministic. The scripted agent solves 6 and 19 and fails 16. The script also has a memory write C5 denies, a mixed reply, an episodic write, and a two-term read.

**Result.** 62 cassettes. `expected-results.jsonl` is written by `make fixtures` and compared on every run.

**Consequence.** A change to any reward, step or memory decision fails `make bench BENCH=tau2`.
