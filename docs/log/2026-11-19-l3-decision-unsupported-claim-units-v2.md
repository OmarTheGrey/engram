---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: plane
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
supersedes: docs/log/2026-11-19-l3-decision-unsupported-claim-units.md
---

**What.** The unsupported-claim lint judges an active episodic or semantic item held at the lint time only when its provenance ref names another item the actor can reach, active, held at the lint time, whose strict content hash is the one the claim recorded.

**Why.** Review L3-4: an expired claim is expired-validity's finding, and an expired source is one Plane.read no longer returns (ADR 0025), so its text must not reach the model or a visible reason. Contradiction already required both items to be held.

**Result.** Five unit cases send nothing; the pilot fixtures' units are unchanged.

**Consequence.** Card L2's unsupported faults must cite an item source with its strict hash, both held at the lint time.
