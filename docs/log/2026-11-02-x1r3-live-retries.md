---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/retry.ts
  - packages/runner/test/model/retry.test.ts
  - packages/runner/test/x1-mem-inv.test.ts
  - packages/runner/test/judge.test.ts
supersedes: none
---

**What.** The agent note retries a transient failure as MEM-INV-Bench's `driver.call` does (four attempts; 429, 500, 502, 503, 524 and network errors; waits of min(2^i, 20) seconds), and the judge as GateMem's router does (three attempts; 429, 500, 502, 503, 504; min(2^i, 10) seconds). The wait is injected. Only the final reply is recorded; a note that fails for good is warned about and falls back; an aborted note stops the run unrecorded. The run summary counts notes that fell back.

**Why.** One 429 or 502 used to write the raw poison into the cassette for good, since pi-ai retries nothing by default (review round 3, V-4).

**Result.** Tests use a fake provider failing twice, then answering. Removing either retry, or recording an aborted note, fails them.

**Consequence.** The judge reply is not stripped: the parser already does, and a test holds that.
