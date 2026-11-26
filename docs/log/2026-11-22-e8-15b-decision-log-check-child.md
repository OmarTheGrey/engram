---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/log-check.ts
  - packages/cli/test/tui/entry.test.ts
supersedes: none
---

**What.** A Postgres log's cheap check runs doctor's `checkLog` in a child process, its URL sent on stdin, with a 10 s timeout, when a question is left and at the start; quitting, or a newer check, kills the child and clears its timer. A SQLite log is still checked in process.

**Why.** Review I1: the plane's Postgres driver connects synchronously, so the check blocked every key for up to 21 s. A worker thread would share the blocked call's module state; a child process is killed outright. 10 s is long enough for a slow network and short enough to say the log did not answer.

**Result.** entry.test.ts quits during a check to an unrouted address and finds no child left.

**Consequence.** Each check costs a Node start, about a second.
