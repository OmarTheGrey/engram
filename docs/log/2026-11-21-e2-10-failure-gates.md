---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - research/scripts/injection_screen.py
  - "make lint"
supersedes: none
---

**What.** Three gates failed on the way: biome refused a character class holding U+200D (an alternation replaced it), tsc refused `ProvenanceKind` as a type (it is the Zod value; `Provenance["kind"]` replaced it), and ruff refused a 103-character docstring line.

**Why.** Each gate is part of the card's definition of done.

**Result.** `make lint`: biome, both tsc projects, ruff, ruff format and mypy pass after the fixes.

**Consequence.** None.
