---
date: 2026-10-29
author: claude-agent
type: failure
card: E2.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/unit/plane/retention.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Three things failed on the way. Invariant 1's read-time generator spread a ttl's end instant, a string, into its characters, so reads ran at times like "6" and the Plane refused them. Its new guard then met no item expiring exactly at the read time. And the first queue test passed with retain outside the queue: its sweep had nothing to do whichever ran first.

**Why.** A generator bug can look like a Plane bug, a guard at zero means the boundary is untested, and a test that passes on a mutant tests nothing.

**Result.** The instant is wrapped in an array; a generator branch (`onATtl`) reads exactly at a one-second ttl's end or a nanosecond before; the queue test now starts from an expired item, so a sweep before the write retires it and the write evicts nothing. All three are fixed and the mutants fail.

**Consequence.** Nothing.
