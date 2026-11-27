---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/saved.ts
  - packages/cli/test/tui/saved.test.ts
supersedes: none
---

**What.** `--no-saved` neither reads nor writes tui.json for the session, and the workspace panel says so.

**Why.** 8.3 says it ignores the file for one session; writing it would overwrite the saved workspace with answers the person chose not to keep.

**Result.** saved.test.ts holds the file byte for byte through a first run under `--no-saved`.

**Consequence.** If wrong, a person who wants to save from such a session restarts without the flag.
