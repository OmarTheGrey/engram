---
date: 2026-11-27
author: claude-agent
type: change
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/mem-inv-probe.ts
  - packages/runner/test/x1-mem-inv.test.ts
supersedes: none
---

**What.** At MEM-INV-Bench's note call, a 401, 402, 404 or non-moderation 403 that stops the run, and each retried transient attempt, now write one ledger line with the attempt's usage. That is `attemptUsage` under the call's key, as at the answer call.

**Why.** The final review's finding 6, and card step 4: every failed attempt's usage goes to the ledger once. Such a reply can carry a cost. pi-ai folds a mid-stream error body's `"code": 402` into the message after tokens were streamed, and `stoppingStatus` reads that code.

**Result.** A new test answers 429 and then 402: the run stops, nothing is recorded, and the ledger has two lines under one key. With the stop's line removed, the test fails (1 line, not 2). x1-mem-inv and mem-inv-probe: 33 of 33.

**Consequence.** No replay moves. The line is written only on the live path.
