---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/injection-screen.test.ts
supersedes: none
---

**What.** The simulator test first failed: it expected steps 1, 2, 5 and 6 to change and the report listed 5 and 6.

**Why.** The test was written before reading how `changed` is computed.

**Result.** The expectation was corrected to the report's definition, and the held writes are asserted through their own policy id instead.

**Consequence.** The finding on the simulator records what this means for its readers.
