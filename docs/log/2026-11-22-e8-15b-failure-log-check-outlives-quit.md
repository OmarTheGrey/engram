---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/log-check.ts
  - packages/cli/src/tui/app.ts
  - packages/cli/test/tui/entry.test.ts
supersedes: none
---

**What.** The verifier's s6b quit while a Postgres check was still running: the TUI left the alternate screen at 3.0 s, but the process lived until 13.8 s.

**Why.** The I1 fix spawned the check's child and kept no handle, so its pipes and its 10 s timer held the event loop open after quitting.

**Result.** Each check now has an abort signal; quitting kills the child and clears its timer, and a test holds no child left running. Under ConPTY s6b exits 1.3 s after leaving the alternate screen, the same gap as a quit with no check (s9).

**Consequence.** None beyond the test.
