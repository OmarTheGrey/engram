---
date: 2026-11-25
author: claude-agent
type: decision
card: E9.9
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/src/oracle.ts
  - "make test-invariants"
supersedes: none
---

**What.** Invariant 2 runs its promotion property a second time, over 250 cases drawn around an owner's acceptance under their own seed, and the oracle reads the rule with its own code.

**Why.** The first run's cases reach an owner's acceptance about once in ten thousand; a new field in its generator would have reshuffled every existing case and guard.

**Result.** The first run's cases are unchanged. New guards require an acceptance landing with provenance and confidence unchanged, and the agent's refusal. `make test-invariants`: 3 files, 21 tests passed. Removing core's source or class check fails invariant 2 with a counterexample. The file is the lead's: a second reviewer is needed.

**Consequence.** The orchestrator's review stands as that second reviewer, or the lead names one.
