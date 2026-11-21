---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** The stateful property defaults to 200 runs of up to 40 commands (fc.commands, size "max"), seeded from the test's name, under the twin profile or a test-only tight variant (budgets of 2 and 1, a 30-day episodic ttl).

**Why.** The card asks for a run well under the 30 s timeout, with a deeper one behind an environment variable; the twin profile's budgets (2,000 and up) are never met by five items, so invariant 5 would hold vacuously.

**Result.** About 3 s for the property, 13.7 s for the file; `make test-invariants` 48.0 s for both files. `ENGRAM_STATEFUL_RUNS`, `ENGRAM_STATEFUL_SEED` and `ENGRAM_STATEFUL_PATH` set a deep run or replay one. The tight variant is no registered preset and changes no condition.

**Consequence.** A rare sequence may wait for a deep run; the guards fail the test if a command kind or outcome is never met.
