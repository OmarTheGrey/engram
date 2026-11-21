---
date: 2026-11-21
author: claude-agent
type: change
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/scripted.ts
  - packages/bench/test/merit/scripted.test.ts
supersedes: none
---

**What.** A scripted upstream for the slice: Engram's own rule-based D1 support agent, a ChatCall that updates addresses, confirms agreed amounts, refunds, and answers the dependent probes from the memory block in its system prompt.

**Why.** Cassettes may be recorded from a scripted model only, and MERIT's mock model draws uuid4 tool call ids and is code we would have to copy.

**Result.** Deterministic: a tool call's id is its message position, and the same request gets the same bytes (test). Usage is a token per four characters, cost 0. Scripted tests pass (6 tests); breaking `agreedAmount` fails one.

**Consequence.** Only D1 is scripted; a D2 or D3 slice needs its own rules.
