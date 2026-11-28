---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.18
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/properties.ts
  - scripts/test/symcc-properties.test.ts
supersedes: none
---

**What.** After the review's changes the result's bytes differed from run to run.

**Why.** Cedar writes entities and parents in hash-map order, and the decoder named scopes in order of sight, so `person:s0` and `person:s1` swapped between runs.

**Result.** The decoder sorts entities and parents first; five runs then give one sha256, and a test that reverses the order fails without the sort.

**Consequence.** Nothing further.
