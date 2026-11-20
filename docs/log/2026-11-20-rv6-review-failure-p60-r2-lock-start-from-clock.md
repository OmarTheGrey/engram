---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/journal.ts
  - packages/runner/test/rv6.test.ts
supersedes: none
---

**What.** The lock took its holder's start as Date.now() minus ps etimes, at one second resolution (verifier finding P60-R2).

**Why.** A clock step of more than 2 s during a long run made a live holder's start differ from the lock's, so the lock was judged gone: the one way it failed open.

**Result.** The start is now absolute: /proc/<pid>/stat starttime plus btime on Linux, ps lstart elsewhere, CIM on Windows as before. The reader is injectable (lockedBy and the journal's startOf). Tests: a matching live holder is kept, a mismatching one taken over, an unreadable one kept; the stat parser is checked on a comm with parentheses. Mutations: treating unreadable as gone fails the first, reading field 21 fails the parser test.

**Consequence.** A clock step no longer frees a live lock by itself; btime is derived from the clock on Linux, so a step between the lock's write and its read can still shift it, which the 2 s slack does not cover.
