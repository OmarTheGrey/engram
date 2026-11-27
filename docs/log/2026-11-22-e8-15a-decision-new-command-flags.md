---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15a
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
  - packages/cli/src/format.ts
supersedes: none
---

**What.** The four new commands' open choices: check opens write's workspace with the store read only; events needs a log that exists; policy takes only `--policy`, `--server` and `--json`; grants checks only a grant's form, as the editor's grantFrom does (mode read by default, a date as midnight UTC).

**Why.** Check must refuse what write refuses; reading commands should not create a log; the policy route takes no actor; what a grant may be is the plane's decision (rule 1).

**Result.** A grant without an expiry is sent and denied by `engram/write/grant`, as the grants test shows. New commands are not added to the shared headings' lists, which would change existing lines; their own sections name the options they take.

**Consequence.** None.
