---
date: 2026-11-25
author: claude-agent
type: failure
card: ANS-2026-11-25
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/tasks-and-decisions.test.ts
  - docs/decisions/README.md
supersedes: none
---

**What.** The mutation check of the tasks-and-decisions test undid the uncommitted edits to the ADR index for a moment.

**Why.** To prove the emptied `OWNER_DECIDES` makes the test judge the accepted ADRs, ADR 0042's index row was set back to `proposed`, and the file was then restored with `git checkout`, which restored the committed version and dropped the card's uncommitted changes to it.

**Result.** The mutation failed the test as it should ("ADR 0042 is decided, has its own file and a decision log entry", 1 failed, 146 passed). The index was restored from a copy taken before the mutation; the rerun passed, 147 of 147, and `make lint-docs` passed.

**Consequence.** Mutation checks on uncommitted documents restore from a copy, or run after a commit.
