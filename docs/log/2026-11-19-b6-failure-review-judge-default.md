---
date: 2026-11-19
author: claude-agent
type: failure
card: B6
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/runner/src/longmemeval-probe.ts
  - packages/runner/test/b6.test.ts
supersedes: none
---

**What.** Review P6-5: a LongMemEval experiment config without a judge fell back to the paper's id, `openai/gpt-4o-2024-08-06`, which a live run would refuse.

**Why.** pi-ai serves that id on the OpenAI Responses API, which takes no seed (ADR 0017), and nothing required an experiment to name its judge.

**Result.** The LongMemEval config schema now refuses an experiment without `judge`, naming the OpenRouter id; a test holds both the load and `run.ts --count` to that error, with no output written. Both baseline configs already name the judge.

**Consequence.** A live run can no longer start with a judge it would refuse.
