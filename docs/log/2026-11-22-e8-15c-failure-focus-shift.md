---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/rich.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: none
---

**What.** After a grant change, focus landed in a text field, so `u` typed instead of undoing.

**Why.** Focus was an index into the screen's stops; the grants list appeared after the change and shifted every stop after it.

**Result.** Focus now follows the focused stop's id when the stops before it change, and a move by the screen is taken as it is. The grants flow test and the parity grants case pass.

**Consequence.** None.
