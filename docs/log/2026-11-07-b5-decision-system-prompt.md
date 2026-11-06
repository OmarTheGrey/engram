---
date: 2026-11-07
author: claude-agent
type: decision
card: B5
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/longmemeval/prompt.ts
  - fixtures/bench/longmemeval/upstream/src/generation/run_generation.py
supersedes: none
---

**What.** A LongMemEval session's system prompt is the one sentence "You are a helpful assistant.", and its user message is upstream's non-CoT reader template with the history slot saying to read memory with the `memory_read` tool.

**Why.** Upstream's reader (`run_generation.py`) sends its template as the only message, with no system prompt, and puts the retrieved sessions into it. In the runner the conditions differ only in what the memory tool returns, so the history cannot be in the prompt. pi 1.3.0 replaces an empty system prompt with its own coding-agent preamble (`customPrompt` is checked for truthiness in its system-prompt builder), so an empty string would not mean "none".

**Result.** `READER_SYSTEM` and `READER_TEMPLATE` in `prompt.ts`; `prompt.test.ts` holds the template to the vendored upstream source.

**Consequence.** Reader accuracy here is not upstream's number; the live baseline reports this deviation.
