---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/events.ts
  - packages/cli/src/tui/screen.ts
  - packages/cli/test/tui/entry.test.ts
supersedes: none
---

**What.** Events, Policy, the item page, Who can read and Supersede (given an item) run their command on opening, through a new `Screen.opened` hook queued behind the key; on Events and Policy `ctrl+s` does not run it again, `r` does. Read, Explain from Home, Write, Promote and Grants wait for `enter` or `ctrl+s`.

**Why.** A screen whose whole content is an answer should show it; a command that changes state, or a read that adopts a store, should not run unasked. E8.15b's entry test presses `ctrl+s` once on Policy and pins one command in the summary.

**Result.** `entry.test.ts` passes unchanged. A read by id on the item page still asks once a session with a store folder.

**Consequence.** None.
