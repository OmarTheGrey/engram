---
date: 2026-11-26
author: claude-agent
type: change
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/openrouter-endpoints.json
  - packages/runner/test/rv6-endpoints.test.ts
  - packages/runner/src/model/upstream.ts
  - packages/runner/src/live.ts
  - "make test-one T=packages/runner/test/rv6-endpoints.test.ts"
supersedes: none
---

**What.** A dated snapshot of OpenRouter's keyless endpoint list for M1, B1's GPT-5.4 and both judges, and an `openrouter_provider` pin in the smoke, B1, H1, H2 and lint configs, each naming the model it was chosen for (`answer_model`).

**Why.** Pre-tag condition 5: the Models rule pins every model and both judges, and no config named an endpoint.

**Result.** M1 on `wafer/us`, GPT-5.4 and both judges on `openai`, `allow_fallbacks: false`; a judge pin only where the config calls a judge (none on MEM-INV-Bench or the lints). A live run whose `MODEL=` differs from `answer_model` is refused. A pin moves a live run's default cassette folder from `cassettes` to `cassettes-upstream-<hash>` (card RV6's `cassetteFolder`); no committed cassette moves, since every live folder is under `.engram/`.

**Consequence.** The smoke run and B1 run on the endpoints H1 will use.
