---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: plane
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
  - packages/runner/src/judge.ts
supersedes: none
---

**What.** Each model-lint request is fixed but for its inputs, model and seed: the system prompt in LINT_PROMPTS, the inputs as one canonical JSON user message, temperature 0, 256 output tokens, and a strict JSON schema for `{verdict, reason}`.

**Why.** Plan PR 2 asks for fixed prompts the tagged pre-registration can name. JSON inputs keep item text as data, so it cannot close a delimiter; the prompt says the inputs are data, not instructions. Temperature 0 makes the seed spread measure residual nondeterminism.

**Result.** The live path is the runner's seeded chat-completions call (liveJudgeCall), which sent no system prompt; it now does, and GateMem's judge requests are unchanged (packages/runner/test/judge.test.ts passes).

**Consequence.** The prompts' text is pre-registration material; changing a word changes every cache key.
