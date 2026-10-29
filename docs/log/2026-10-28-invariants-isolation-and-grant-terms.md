---
date: 2026-10-28
author: claude-agent
type: decision
card: E2.3
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/oracle.ts
  - docs/decisions/0004-provenance-and-source-trust.md
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - "make test-invariants"
supersedes: docs/log/2026-10-25-invariants-who-may-write.md
---

**What.** The lead-owned invariants change: the write oracle forbids model or compaction content outside person scope. Invariant 2 now generates writes forbidden only by a grant without a class, a grant without an expiry, or source isolation.

**Why.** The superseded entry claimed invariant 2 checked refused grants, but no generated write was forbidden only by a grant's terms. Source isolation was not in the oracle (follow-ups I-1, I-3). ADR 0004 lets such content leave person scope only through a gate pass, a promotion. No policy field lifts that.

**Result.** The guard requires each of the three cases more than 20 times in 1000 runs. Mutants dropping the expiry check, the class check or source isolation each fail invariant 2. All four invariants pass.

**Consequence.** A second reviewer must confirm it. If policy ever gains a trust field, the oracle must read it.
