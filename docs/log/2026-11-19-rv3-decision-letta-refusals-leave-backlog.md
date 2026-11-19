---
date: 2026-11-19
author: claude-agent
type: decision
card: RV3
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - packages/adapters/test/letta/rv3.test.ts
supersedes: none
---

**What.** The backlog row "Letta delete refusals" leaves the backlog: card RV3 made `UnsafeLettaPathError` and `NotMemfsRepositoryError` `NotDeletableError`s.

**Why.** The card's brief asked for it beside RV-ADP-5, and the backlog's rule is that taking an item off it is a decision entry.

**Result.** The row now reads done on branch rv3, with the tests that show it (`packages/adapters/test/letta/rv3.test.ts`). `RepositoryBusyError` (a detached HEAD, a rebase in progress) is kept transient, since it ends when the operation does; cost if wrong: an offboarding during a long rebase keeps its items back until a rerun.

**Consequence.** Nothing else on the backlog changes because of it.
