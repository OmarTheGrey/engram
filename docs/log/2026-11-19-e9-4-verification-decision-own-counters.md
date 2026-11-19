---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Each of invariant 5's walks counts what it saw in its own counters and is held to its own guards: the first walk to the original retention guards, the grant walk to the grant guards. This changes the lead-owned file and only strengthens it.

**Why.** Verification finding V-6.

**Result.** The first walk alone meets its guards (among them utility evictions decided by reads 2, sweep evictions 5).

**Consequence.** ADR 0034 lists it.
