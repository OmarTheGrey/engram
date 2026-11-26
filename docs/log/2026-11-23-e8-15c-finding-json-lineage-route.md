---
date: 2026-11-23
author: claude-agent
type: finding
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/actor-switch.test.ts
  - packages/cli/src/commands.ts
supersedes: docs/log/2026-11-22-e8-15c-finding-json-lineage.md
---

**What.** For the lead: `engram read --json`, and so the TUI's `J` view, prints every returned item whole, its `lineage` included, so it names ancestor ids the reader may not read. The TUI's own drawing never does, and the review confirmed it on sam's read of a team item.

**Why.** The read route returns the item as stored; E8.11's leak rule is a display rule for the graph. Fixing it in the TUI would break parity with the CLI and the API.

**Result.** Recorded, not fixed: the fix belongs in the read route, so the CLI, the API and `J` agree. It is the same family as lead-decisions item 36.

**Consequence.** A plane card: withhold lineage ids the reader may not read in the read route's items.
