---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: limitations
pillar: plane
hypothesis: H4
evidence:
  - docs/decisions/0035-store-independence-is-a-design-property.md
  - research/results/MANIFEST.md
  - docs/research/preregistration.md
supersedes: none
---

**What.** "Store independence proven by request identity", one of the four differences the card lists, is stated as a design property, not as a proven result.

**Why.** ADR 0035 decides that a request-identity check, comparing the sha256 of every model request across adapters, proves it, and that a card builds the check. No card has built it: `research/results/MANIFEST.md` has no row for it and no script produces it. The registered H1 runs use one store, Mem0 (`docs/research/preregistration.md`, H1 stopping rule).

**Result.** What holds now: one adapter contract and conformance suite over files, Mem0 and Letta (ADR 0013), and the design argument that the plane ranks in core and alone decides what reaches the model (ADR 0031, decision 2).

**Consequence.** When the request-identity check has a MANIFEST row, the positioning may say "proven" and cite it.
