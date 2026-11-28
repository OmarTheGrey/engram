---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.6
chapter: design
pillar: research
hypothesis: none
evidence:
  - scripts/check-absorbed.ts
  - docs/conventions/absorption.md
supersedes: none
---

**What.** Beyond the card's three checks, the script also requires seven cells, a 40-character commit, a mode of copy or port, at least one backticked landed path, and CC-BY-4.0 only on a mode marked `(data)`.

**Why.** Each is a rule of ADR 0037 or the absorption convention that review checks today, and the first and fourth are needed for the card's checks to read a row at all: a split row misplaces its paths, and a row with no backticked path would pass the existence check vacuously.

**Result.** All hold on main's 24 rows after the pipe fix. Landed paths are the backticked spans holding a slash, so a span like `resolveSupersessionHead` is not one.

**Consequence.** A future row puts its paths in backticks and its commit in full.
