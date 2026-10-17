---
date: 2026-10-17
author: omar
type: finding
card: S0.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - fixtures/sessions/s0-interception.jsonl
  - fixtures/sessions/s0-interception.expected.json
  - packages/pi-extension/test/interception.test.ts
  - "pnpm --filter pi-extension test"
supersedes: none
---

**What.** Step-0 task S0.5 pinned pi 1.3.0 and proved the interception points in a pi SDK session with a scripted model: tool_call blocks an org-scoped memory_write, context tags memory, every decision is an `engram.event` custom entry, and store commands are blocked in user_bash and in the model's bash tool.

**Why.** ADR 0001 rests on these events behaving as documented.

**Result.** tool_call, context and appendEntry behaved as documented; 15 tests pass. Three differences: `createAgentSession` has no `extensionFactories` option (it moved to `DefaultResourceLoader`); `session.executeBash` never emits user_bash, only the interactive and RPC hosts do; user_bash has no block result, so blocking returns a replacement result.

**Consequence.** The runner must emit user_bash itself. The context tag is request-local; the session keeps untagged results.
