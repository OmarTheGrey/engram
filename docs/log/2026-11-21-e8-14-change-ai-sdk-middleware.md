---
date: 2026-11-21
author: claude-agent
type: change
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ai-sdk/src/index.ts
  - packages/ai-sdk/test/middleware.test.ts
  - packages/ai-sdk/test/scripted.ts
  - "make test-one T=packages/ai-sdk/test/middleware.test.ts"
supersedes: none
---

**What.** `packages/ai-sdk` (`@engram/ai-sdk`): `engramMemory(options)`, returning a `LanguageModelV4Middleware` and the tools `remember` and `recall`.

**Why.** Card E8.14 step 3: the smallest framework seam and the quickest demo.

**Result.** `transformParams` reads with the last user text and inserts the tagged recall as one system message after the leading ones, its read id in `providerOptions.engram`; it defuses every `<engram` opener elsewhere in the prompt and withholds a `recall` tool result this instance did not produce. Writes happen only through `remember`, as the bound actor with source `model` and ref `ai-sdk:tool_call/<id>`; a denial throws `EngramRejected`. 9 tests pass on a scripted LanguageModelV4 of the package's own, a two-step tool loop and a streamed call among them.

**Consequence.** Other tools an application gives the model stay ungoverned, as ADR 0022 says of MCP.
