---
date: 2026-10-25
author: claude-agent
type: failure
card: A1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/mem0/mem0.test.ts
  - packages/adapters/src/mem0/index.ts
supersedes: none
---

**What.** The first test of mem0.test.ts, the write, search and delete cycle, timed out at vitest's 5 s default in one of three full parallel suite runs, and passed when run alone.

**Why.** The first Mem0 instance in a file loads `mem0ai/oss`, which the adapter imports lazily. A probe run timed that import at 4.7 s; better-sqlite3 took 0.08 s, building the instance 0.18 s, and a second instance 2 ms. The first test paid the import inside its own budget.

**Result.** Over three full `pnpm exec vitest run` passes with a JSON report, the first test took 3325, 3907 and 5850 ms (the last timed out); the other in-process tests took 1 to 164 ms. The conformance suite's first mem0 test shows the same cost, 2447 to 4580 ms.

**Consequence.** The import moves out of the test body; see 2026-10-25-a1-mem0-test-warm-load.md.
