---
date: 2026-10-29
author: claude-agent
type: change
card: B1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/bench/src/gatemem/judge.ts
  - packages/bench/src/gatemem/vendor/judge_prompt.txt
  - packages/bench/test/gatemem/judge.test.ts
  - packages/bench/scripts/upstream-judge-golden.py
  - fixtures/bench/gatemem/upstream-judge-golden.json
  - fixtures/bench/gatemem/judge-script.json
  - fixtures/bench/gatemem/judge-cassettes
  - "ENGRAM_OFFLINE=1 make bench BENCH=gatemem"
supersedes: none
---

**What.** GateMem's LLM judge is ported: the vendored prompt (MIT, hashed in the manifest), upstream's three-attempt plan with the strict `benchmark_judge` schema, its JSON and `key: value` reply parsing, coercion, notes redaction, gating and summary, as a `ModelCall` at the paper's settings (`openai/gpt-4o`, temperature 0).

**Why.** B1's acceptance compares with the paper's judge scores, not the rule-based ones.

**Result.** 67 judge tests match what upstream's own code returns at a983828 (40 crafted replies, 13 redactions, 7 crafted prompts, both gate settings on 20 checkpoints). `make bench` replays 24 scripted judge calls: action_ok 0.950, utility 0.167, privacy leak 0.167, deletion leak 0.143. Six mutants were killed.

**Consequence.** The live run needs only a pi-ai structured-output path and the pre-registration.
