---
date: 2026-11-21
author: claude-agent
type: change
card: R3
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - README.md
  - docs/architecture.md
  - docs/research/positioning.md
supersedes: none
---

**What.** `README.md` and `docs/architecture.md` each gained one short paragraph that states the claim: to our knowledge, the first deterministic, event-logged, replayable control plane across memory stores, with a pre-registered measurement of its governance tax. Each names HEAMS and SAFE-Mem as the nearest neighbours and points at `docs/research/positioning.md`.

**Why.** Card R3, step 3. Before this card neither file stated what is new. The grep the card names (`first`, `novel`, `no existing`, `nobody`, `none of`) over `README.md`, `docs/architecture.md`, `docs/research/` and `research/thesis/` found no novelty sentence; every hit was about something else, such as a first run or a first draft.

**Result.** Two paragraphs added, no other sentence changed. The architecture paragraph also names the two limits of the claim (ADR 0032 and ADR 0035).

**Consequence.** The README overhaul by another agent should keep the paragraph or move it whole.
