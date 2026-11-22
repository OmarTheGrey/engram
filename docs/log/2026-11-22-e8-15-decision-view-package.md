---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - packages/ui/src/view.ts
  - packages/ui/src/provenance.ts
supersedes: docs/log/2026-11-21-e8-15-decision-reuse-inspector.md
---

**What.** The inspector's pure view logic (`view.ts`, `provenance.ts`) moves into a new React-free workspace package, `@engram/view`, which the inspector and the TUI both import; there is no `@engram/ui/view` export.

**Why.** Decided on 2026-11-22 under the lead's delegation (item 62, call 4). Depending on `@engram/ui` would have brought React, xyflow, dagre and tanstack into the CLI's dependency graph, the review's finding E8.15-19; a small package keeps the leak rule in one place and the CLI free of React.

**Result.** Section 6.3 of the design and E8.15c of the card, whose acceptance includes the inspector's tests passing unchanged.

**Consequence.** Supersedes the entry that proposed the subpath export.
