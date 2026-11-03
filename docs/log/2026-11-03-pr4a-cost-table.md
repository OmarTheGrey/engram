---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/cost-shapes.ts
  - packages/runner/scripts/cost-shapes.ts
  - packages/runner/test/research/cost-shapes.test.ts
  - research/scripts/h1_cost.py
  - research/configs/h1-cost.json
supersedes: none
---

**What.** H1's cost table is a rule-9 result: an entry point measures the fixture cassettes' session shapes, GateMem's prompt sizes and the candidates' catalogue entries, and `research/scripts/h1_cost.py` prices COUNT's sessions with them.

**Why.** Plan decision 7: costs come from measured shapes, not guesses, priced from pi-ai's catalogue at its pin.

**Result.** Tokens are pi's own estimate (`estimateTokens`) of each decoded cassette message; reads are the `memory_read` results only (a mutant counting C4's legend fails a test); the full set's memory comes from `h1-c4-walk.json` and `h1-mem-inv-admission.json`, whose sha256 the result records; the prices are dated by pi-ai's catalogue (`generatedAt` 2026-10-15T19:00:55.287Z). Python tests hold the session arithmetic, the per-million pricing and the reasoning rule; mutants dropping the growth of extra turns or billing reasoning to every model fail them.

**Consequence.** Part B's decision sheet cites `research/results/h1-cost.json` for the model choice.
