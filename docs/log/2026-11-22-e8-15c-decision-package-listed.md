---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - AGENTS.md
  - README.md
  - packages/view/README.md
supersedes: none
---

**What.** The new package is listed where every package is: one line in AGENTS.md's "Where things live" (and CLAUDE.md), one row in the root README's package table, and its own README; `docs/deps.md` gets no row.

**Why.** The card's file list names none of these, but every other package has all three, and AGENTS.md says it is the map of the repository. `docs/deps.md` lists external dependencies only: no `@engram/*` package has a row.

**Result.** `cmp AGENTS.md CLAUDE.md` is silent; both files gain the same line.

**Consequence.** If the lead prefers the card's list alone, the three additions are removed and nothing depends on them.
