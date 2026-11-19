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
  - fixtures/faults/model/unsupported-claim.near-miss.json
supersedes: none
---

**What.** The unsupported-claim lint judges an active episodic or semantic item only when its provenance ref names another item the actor can reach, active, whose strict content hash is the one the claim recorded.

**Why.** The model needs the source text, which only an item ref provides; a gone or changed source is already the orphan or source-changed finding, so a model call there would double-count and cost.

**Result.** The near-miss fixture holds a changed source, an unreachable one, a non-item ref and a procedural claim: none sent; one supported claim sent.

**Consequence.** Card L2's unsupported faults must cite an item source and record its strict content hash, or this lint never sees them.
