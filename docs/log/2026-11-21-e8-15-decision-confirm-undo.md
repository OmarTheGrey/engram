---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
supersedes: none
---

**What.** Confirmation follows the registry's write class, and undo is offered only for a grant change.

**Why.** The brief asks for confirmation before anything that writes, retires, promotes or erases, and undo only where the plane allows it. Reads and lints only append audit events, so asking before each would teach people to click through; a grant change is the one operation with a governed inverse.

**Result.** Section 9.5: none for doctor, simulate, explain, policy, check, who-can-read and events; a one-time adoption notice for the first read of a store folder; a dialog for write, promote, grants, retain, import, supersede and key create; a typed confirmation for key revoke and signing. Section 9.6: undo of a grant change is a new governed change that may be denied.

**Consequence.** If the lead wants reads confirmed, it is one registry field per command.
