---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/item.ts
  - packages/cli/src/tui/screens/rich.ts
supersedes: none
---

**What.** The item page uses only answers the session got as the actor acting now (each result's request names its actor), and runs `engram read --item <id>` first when no such read holds the item, then `engram events`.

**Why.** 8.17 builds the page from the session's last read and events; after a change of actor (the workspace panel, the reviewer handoff) the last read may be another viewer's, which would show one viewer what the plane returned to another.

**Result.** The leak test drives sam's item page over every pane and two sizes: dana's note's id never appears, while dana's own page shows it.

**Consequence.** None.
