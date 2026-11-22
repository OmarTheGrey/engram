---
date: 2026-11-22
author: claude-agent
type: change
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/supersede.ts
  - packages/core/test/property/supersede-leak.test.ts
  - packages/server/test/supersede.test.ts
  - packages/server/src/routes.ts
  - packages/cli/test/supersede.test.ts
  - packages/mcp/test/supersede.test.ts
  - "make test-one T=packages/core/test/property/supersede-leak.test.ts"
supersedes: none
---

**What.** The review fix pass of L6 covered eight findings, L6-1 to L6-8.

**Why.** The review found one critical issue (the plan disclosed and rewrote items the read filter refuses), three important ones and three minor ones, and the merge of main had 7 conflicts.

**Result.** L6-1: the plan reads through `evaluateRead`, with a leak property (300 runs) and the reviewer's probe as a server test, both failing on the old code. L6-2: a retired-link plane test. L6-3: a refused close is reported in `stopped`. L6-4: trust-floor MCP tests. L6-5: the cycle text. L6-6: a CLI test for a denied close. L6-7: a sync before planning. L6-8: the merge, and a test of authenticated sessions. Each fix has a mutant its test kills.

**Consequence.** The entries the fixes falsified are superseded one by one.
