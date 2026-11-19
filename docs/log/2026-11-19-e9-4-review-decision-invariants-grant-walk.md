---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Invariant 5 runs its walk twice: the original steps under the original seed, then steps extended with grant changes and reads by a grantee, under a policy honouring grants, under their own seed. This changes the lead-owned file, for review.

**Why.** Extending the original steps reshuffled every draw, and invariant 5's coverage guards fell to zero (utility evictions decided by reads, sweep evictions); a second walk adds the grant checks and leaves the original draws as they were. Each read is checked against the oracle's own replay of the allowed events, and every grant on a returned item must come from a gated write or an owner's allowed change.

**Result.** The invariants pass; the grant walk saw 113 allowed changes, 6 reads admitted by a changed grant and 3 refused after a removal (guards require each).

**Consequence.** ADR 0034, consequences, lists every change to the file.
