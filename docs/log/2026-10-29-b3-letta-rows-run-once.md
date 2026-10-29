---
date: 2026-10-29
author: claude-agent
type: change
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/b3.test.ts
  - "pnpm --filter runner exec vitest run test/b3.test.ts"
supersedes: none
---

**What.** The B3 acceptance test runs the Letta rows once: the first offline run covers fake, Mem0 and Letta, and the second, which shows that a rerun gives identical rows with no new call, covers fake and Mem0 only. Its bound is back to 300 s.

**Why.** Each Letta pass commits 474 GateMem turns, which took the test to about 207 s on Windows (see the finding on Letta sessions). The determinism check depends on the cassettes and the plane, which are the same on every store, and is already shown on two stores.

**Result.** The test takes 113 s on this machine (the whole file 133 s), with 18 cached calls on the first run and 12 on the second; Letta's three rows are still checked in full on the first run.

**Consequence.** None for CI, where git processes are cheap.
