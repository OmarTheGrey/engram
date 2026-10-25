---
date: 2026-10-25
author: claude-agent
type: change
card: A1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/registry.ts
  - packages/adapters/test/conformance/conformance.test.ts
  - docs/log/2026-10-25-a1-mem0-test-timeout.md
supersedes: none
---

**What.** The conformance registry's mem0 entry now has a one-time `setup` that builds a throwaway Mem0 instance. conformance.test.ts runs it in its beforeAll, after the network guard and MEM0_DIR, with a 60 s timeout.

**Why.** The first mem0 case paid the `mem0ai/oss` load inside its beforeEach factory, the same cost that timed out mem0.test.ts.

**Result.** Over three full `pnpm exec vitest run` passes with a JSON report, the first mem0 case took 3131, 3069 and 2998 ms before and 23, 25 and 26 ms after; the slowest mem0 case after is 57 ms. No case or assertion changed. The suite's closing checks for network calls and Mem0's home folder still pass, and they now cover setup.

**Consequence.** No conformance case pays a module load. A new adapter with a costly first load adds a `setup` to its entry.
