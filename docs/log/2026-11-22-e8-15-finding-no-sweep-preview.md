---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - docs/design/tui.md
supersedes: none
---

**What.** The plane has no read-only preview of a retention sweep, so the TUI cannot say before a read how many items the owner's sweep would retire.

**Why.** Review improvement 8 asked the read dialog to show the expired count. `POST /retain` sweeps for real, and `POST /read` runs the owner's sweep before reading; neither has a dry run, and the TUI may not compute one itself (AGENTS.md rule 1).

**Result.** The read dialog of section 8.5 says that any expired item will be retired, without a number, and the design names a sweep preview as a backlog item for the plane.

**Consequence.** A later plane card could add a preview route; the dialog would then show its count with no other change.
