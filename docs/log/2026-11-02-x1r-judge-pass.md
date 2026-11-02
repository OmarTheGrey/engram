---
date: 2026-11-02
author: claude-agent
type: change
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/judge.ts
  - packages/runner/src/run.ts
  - packages/runner/test/judge.test.ts
supersedes: none
---

**What.** The runner judges every GateMem answer as GateMem's scoring does, with card B1's judge port, when the config names a judge; an experiment that names none gets the paper's (`openai/gpt-4o`, temperature 0, 4096 tokens).

**Why.** The runner scored with the rule-based scorer only, while GateMem scores access, forgetting and utility with its judge (review J1).

**Result.** Each judge call is cached under the session's item, condition, preset and store with the judge model, the seed and the prompt hash; a rerun makes no call. The summary is promoted as `score_predictions.py --use_llm_judge` promotes it. The X1 fixture records a scripted judge: 20 judge calls.

**Consequence.** H1's GateMem rows carry the paper's A, F and U verdicts.
