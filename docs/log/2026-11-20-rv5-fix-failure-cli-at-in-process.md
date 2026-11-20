---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
  - packages/cli/test/clock.test.ts
supersedes: none
---

**What.** Review of PR #59, RV5-3: in process, `engram write`, `promote`, `retain` and `lint --at` still set the call's clock, so `retain --at <future>` retired the member's own items for good and a backdated write was stamped before the log's history.

**Why.** RV5 refused `--at` only with `--server`; in process the CLI is the server and took the caller's time.

**Result.** Reproduced red by clock.test.ts (7 of 8 failing); fixed by refusing it unless `--test-clock` (rv5-fix-decision-test-clock).

**Consequence.** Dogfood members cannot set the clock of anything but a read's validity time.
