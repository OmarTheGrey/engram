---
date: 2026-11-19
author: claude-agent
type: change
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - packages/runner/src/conditions.ts
  - packages/runner/test/rv1.test.ts
  - "pnpm --filter runner exec vitest run test/rv1.test.ts"
supersedes: none
---

**What.** A transient failure of the answer model no longer aborts a run: the session's model retries it with the benchmark client's policy, and a session is judged on its final assistant message (review finding RV-EXP-1).

**Why.** pi's AgentSession retried a 429 on its own, but the probes threw the first recorded error even after the session recovered, so one 429 killed a run of 80,000 serial calls.

**Result.** Before, the review's repro rejected with "model call failed: 429". After: the same repro (a faux `openai-completions` provider whose first reply is a 429, one B3 checkpoint under C2) gives one row, three provider calls, two new calls and two cassettes, after one injected wait of 1,000 ms. A 400 fails at once; three 503s fail after three attempts.

**Consequence.** GateMem and LongMemEval answers retry as GateMem's router does, MEM-INV-Bench's as its driver does.
