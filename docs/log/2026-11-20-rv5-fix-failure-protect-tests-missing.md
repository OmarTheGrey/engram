---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/attacks.test.ts
supersedes: none
---

**What.** Review of PR #59, RV5-7: attacks.test.ts had no case for the log's `-journal` file, pi's agent folder, or a link into `.pi`.

**Why.** pi-package lists all three in `protect`, but only the log, `-wal`, `-shm` and `.pi` were exercised.

**Result.** A new case blocks a write and `rm` of `-journal`, writes into the agent folder and its `rm -rf`, and write, edit and `rm` through a junction (a symlink off Windows) into `.pi`. It passed at once; mutants that drop `-journal` from `protect` or skip core's realpath in `canonical` each turn it red.

**Consequence.** The three are now pinned by tests.
