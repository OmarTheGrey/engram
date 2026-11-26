---
date: 2026-11-26
author: claude-agent
type: failure
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/frames-memory.test.ts
  - packages/cli/test/tui/screens.test.ts
supersedes: none
---

**What.** Two failures came up while the guard was rebuilt. The eight Policy frames failed with "Cannot read properties of undefined (reading 'includes')". The `make tui-screens` capture test also failed, once, on its `git status` check.

**Why.** PolicyScreen now takes the check's answer instead of its policy id as text, but `frames-memory.test.ts` still passed a string. `tsc` in `make lint` named the same line. The capture test compares `git status` before and after it runs, and `AGENTS.md` was edited while it ran.

**Result.** The frames test now passes `{ policy_id: "fixture/write/team" }`, and the frames are unchanged. The rerun, with no edit during it, passed 684 of 684.

**Consequence.** Files are not edited while the capture test runs.
