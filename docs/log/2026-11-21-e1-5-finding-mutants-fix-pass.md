---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.5
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - specs/commit.qnt
supersedes: none
---

**What.** Four more mutants after the fix pass, each against the four properties (5,000 traces of 60 steps, seed 1) and the scenario tests.

**Why.** To show the new clauses catch what they are for.

**Result.** A report closing every open mark: caught by noWriteWhileErasing. The old trust clause restored: refuted by adoptionNeverRaisesTrust and asHeldKeepsTrustTest. Adoption never keeping the plane's provenance: caught by asHeldKeepsTrustTest only (stricter, so no property fails). `asHeld` comparing content alone: caught by nothing, since the model cannot make a record with the plane's content and another kind.

**Consequence.** Nothing further for this card.
