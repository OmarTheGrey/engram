---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/runner/test/judge.test.ts
supersedes: none
---

**What.** Review finding L3-7: GateMem's judge test asserted the live call's `context.messages` only, so a mutant sending an empty system prompt for the judge survived.

**Why.** Card L3 changed liveJudgeCall to send a request's system prompt; the judge sends none, and the test did not check that.

**Result.** The test now asserts the whole context with toEqual; sending `systemPrompt: ""` when the request has none fails it.

**Consequence.** GateMem's judge requests are held to exactly what they were before L3.
