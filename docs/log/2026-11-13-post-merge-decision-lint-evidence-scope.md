---
date: 2026-11-13
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0009-retrieval-explanations.md
supersedes: none
---

**What.** Reach decides whether a lint finding is raised; the linted scope decides what its evidence may say. ADR 0009 gains a post-merge amendment refining its 2026-11-13 one.

**Why.** Every member of the linted scope sees the lint event, so evidence about an item outside the scope must not exceed what the linted item records itself: its provenance ref, recorded hash and lineage ids.

**Result.** The finding is still raised when the linting actor can reach the item, so a member learns one bit: the source changed, or a cited item is no longer active. Raising nothing would hide a stale derivation from the person who can fix it, so the bit is accepted.

**Consequence.** Orphan evidence for an absent item now reads `names no active item you can reach`, the same text as for a retired item outside the scope; the fault catalogue regenerated unchanged.
