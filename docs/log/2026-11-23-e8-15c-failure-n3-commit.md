---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/actor.ts
supersedes: none
---

**What.** The first commit of N3, `02792e91`, failed 113 TUI tests and was pushed before the full run's result was read.

**Why.** The actor now was built with `--member` as an empty list when the workspace named none, so its memberships were none, while every command builds it with no `--member` and gets its own scope: no answer matched the actor now, and every screen hid its own answers.

**Result.** The next commit builds the actor as the commands do; all 322 TUI tests passed again, and Promote's hint now names the actor's own scope, which the empty list had hidden.

**Consequence.** The full TUI run is read before a commit is pushed.
