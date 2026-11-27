---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/forms.ts
  - packages/cli/src/tui/app.ts
  - packages/cli/test/tui/parity.test.ts
supersedes: none
---

**What.** Checking a form hands `prepare` a fixed placeholder id, and a look (Write's check preview, the Events follow poll) runs through `peek` with ids of its own and is not in the session's summary.

**Why.** Before, validating a write drew a fresh id from the session's ids, so the TUI's write was not the plain command's write with the same ids; a preview that drew ids would move every later one.

**Result.** The parity test holds each action to the plain command's requests and bytes from the same state and ids. Mutation: validation drawing the session's ids again fails the write cases (2 tests).

**Consequence.** The preview's own check request carries a placeholder item id, not the one a later plain `engram check` would draw; its decision is the same.
