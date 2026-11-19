---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/oracle.ts
  - "make test-invariants"
supersedes: none
---

**What.** Invariant 2's write oracle (`writeForbidden`, lead-owned) now forbids a write carrying one grant twice, by the oracle's own `grantsAlike` (every field, the expiry as an instant).

**Why.** The write gate now refuses it (review finding M1); an oracle weaker than the gate leaves the new rule unchecked by invariant 2. It is the smallest change that strengthens the oracle: it forbids more and permits nothing new.

**Result.** Five invariants pass.

**Consequence.** For the lead's second review; ADR 0034 lists it.
