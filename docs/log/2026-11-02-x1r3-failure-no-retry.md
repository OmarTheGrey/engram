---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/mem-inv-probe.ts
  - packages/runner/src/judge.ts
supersedes: none
---

**What.** Round 2 recorded a failed note call on its first failure, so one transient 502 or 429 in a live run would have written the raw poison into the cassette for every replay, and the live judge gave up on its first transient failure too.

**Why.** Round 2 matched upstream's fallback, not its driver's and router's retries, and pi-ai's default retry count is 0.

**Result.** Both calls retry as upstream does, and an aborted note is never recorded (`x1r3-live-retries`).

**Consequence.** Found by the third review of PR #25, before any live run.
