---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/test/tui/saved.test.ts
supersedes: none
---

**What.** The Forget saved workspace test timed out at 30 s.

**Why.** Keys were handled one after another on one promise chain, and the action that asked for confirmation awaited the answer on that chain, so the key that answers it could never be handled.

**Result.** Keys that arrive while a confirmation waits now go on a side chain, and `settled()` treats a parked confirmation as settled; the test passes.

**Consequence.** Any later dialog that awaits a key uses `confirm`, which parks correctly.
