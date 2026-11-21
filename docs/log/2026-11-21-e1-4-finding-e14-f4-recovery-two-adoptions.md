---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - "ENGRAM_STATEFUL_RUNS=4000 make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: none
---

**What.** Finding E14-F4: after crashes, recovery by adoption can need two passes, not one, when a pass's own budget check changes an item it listed.

**Why.** The deep run's second counterexample (4,000 runs, seed -19116893, path "3410:3:2:9:9:8", shrunk five times), under a role budget of one: a role write killed before its commit leaves item 4's bytes; item 5 is written with a grant; a grant removal on item 5 is killed after its store write.

**Result.** The first adoption records item 4, whose budget check evicts item 5, so item 5's listing is stale and deferred (P50-7). The second adopts item 5's narrowed record, which evicts item 4. The third appends nothing. Every invariant holds throughout. The main property allows three passes; the test named `E14-F4` pins this one.

**Consequence.** Minor. Surfaces adopting on every read converge; a one-shot recovery should loop until a pass appends nothing.
