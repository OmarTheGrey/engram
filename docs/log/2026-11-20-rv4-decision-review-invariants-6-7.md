---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - AGENTS.md
  - docs/conventions/testing.md
supersedes: none
---

**What.** Two invariants are added to the lead's invariants file: adoption never records a kind more trusted than the plane holds for the item's id (`import` for a new id), and never a grant the plane does not hold for it.

**Why.** The review asked for them. The file needs a decision entry and a second reviewer (docs/conventions/testing.md); the reviewer of PR #58 is that reviewer. Each case writes through the plane, edits the store outside it (content, kind, grants, a re-filed id, a deletion) and adopts; the oracle replays the log itself.

**Result.** Both pass at 1000 runs with guards; each fails when its rule is broken in `adoptedItem`. AGENTS.md, CLAUDE.md, the Makefile help and testing.md now say seven invariants.

**Consequence.** `make test-invariants` takes a few seconds longer.
