---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/rich.ts
  - packages/cli/src/tui/screens/read.ts
  - packages/cli/src/tui/screens/item.ts
  - packages/cli/src/tui/screens/write.ts
  - packages/cli/src/tui/screens/grants.ts
  - packages/cli/src/tui/screens/events.ts
  - packages/cli/src/tui/screens/who.ts
  - packages/cli/src/tui/screens/memory.ts
supersedes: none
---

**What.** Ten screens over the registry's own Form and `run`: Read and explain (scope lanes, the selected item's explanation), Explain, the item page (provenance tree, versions with a line diff, events naming the item), Write with a live `engram check` preview and its neutral shortcuts, Promote with the reviewer handoff, Grants with undo, Events with filters, find and follow, Policy as a foldable tree, Who can read and Supersede.

**Why.** Card E8.15c and `docs/design/tui.md` 8.5 to 8.8, 8.16 to 8.19, 8.22 and 8.26.

**Result.** Each screen shows its command in the command row, the decision first on every result, the reason and policy id as the answer carried them, `v` and `J` with the CLI's bytes; all text passes `clean` and the URL redaction. Other commands keep the generated form.

**Consequence.** E8.15d's screens can reuse `RichScreen` (focus by stop id, the Advanced fold, the views).
