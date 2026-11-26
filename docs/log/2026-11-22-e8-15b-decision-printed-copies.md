---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
supersedes: none
---

**What.** What `c` could not copy is printed on quit redacted, like every printed command line, while `c` copies the whole command, secrets included.

**Why.** Review I4: the summary and the command row showed a Postgres password; a copy the person asked for is theirs, but stdout and scrollback are not a clipboard.

**Result.** review.test.ts: the deferred copy holds the password, the printed summary does not.

**Consequence.** On a terminal with no clipboard path, a person retypes a secret, as with ENGRAM_DB_URL.
