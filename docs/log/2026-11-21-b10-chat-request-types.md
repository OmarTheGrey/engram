---
date: 2026-11-21
author: claude-agent
type: change
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/cached.ts
  - packages/model/src/scripted.ts
  - packages/model/test/scripted-call.test.ts
supersedes: none
---

**What.** The cached call's types are widened in `packages/model/src/cached.ts`: `ChatRequest` (messages the ModelRequest shape cannot hold, `tools`, `toolChoice`, `params`), `ChatResponse` (`toolCalls`, `finishReason`) and `ChatCall`; `cacheKey` takes a ChatRequest and `cached()` is generic, defaulting to ModelRequest and ModelResponse.

**Why.** Core's ModelRequest holds only text user and assistant messages, so tau2-bench's tool definitions and tool calls could not be carried or hashed. Core is not edited (rule 5 and the card's scope).

**Result.** Before: `cacheKey(context, ModelRequest)`, `cached(ModelCall)`. After: a ChatRequest with no widened field is a ModelRequest with the same key; every caller type-checks unchanged (tsc clean in `make lint`), and the model, runner cache and judge, and bench GateMem tests pass (63 tests). `scriptedChatCall` is the scripted model for tool replies.

**Consequence.** Readers that assume string message content in a cassette's request need care on proxy cassettes; see the B10 finding.
