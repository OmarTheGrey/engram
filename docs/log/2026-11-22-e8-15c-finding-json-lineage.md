---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/flows.test.ts
  - packages/cli/src/commands.ts
supersedes: none
---

**What.** The leak rule holds on the item page and in every rich frame, but `engram read --json` prints each returned item whole, its `lineage` included, so the read's `J` view, which is the CLI's bytes, names an ancestor the reader may not read.

**Why.** Found while writing the leak test: the read route returns the item as stored, and E8.11's rule is a display rule for the graph.

**Result.** The TUI's own drawing never prints a lineage; the plain CLI and the API do, as they did before this card.

**Consequence.** A question for the plane, not the TUI: whether the read route should withhold lineage ids the reader may not read. Not changed here (out of scope, routes).
