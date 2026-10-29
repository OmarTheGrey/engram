---
date: 2026-10-25
author: claude-agent
type: change
card: A1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/mem0/mem0.test.ts
  - docs/log/2026-10-25-a1-mem0-test-timeout.md
  - make test
supersedes: none
---

**What.** The beforeAll hook of mem0.test.ts now builds one throwaway Mem0 instance, under the fetch stub and the temporary MEM0_DIR, with a 60 s hook timeout.

**Why.** The `mem0ai/oss` import is the cost, it is paid once per file, and the tests need no other change; sharing it per file fixes the cause instead of raising every test's timeout.

**Result.** Over three full passes the first test took 48, 51 and 55 ms, down from 3325 to 5850 ms. Five consecutive `make test` runs passed. The first test still asserts no fetch call and no Mem0 home folder, so the warm-up is checked too.

**Consequence.** The conformance suite's first mem0 test still pays the import inside its 5 s budget; it is an acceptance test and is left for its own fix.
