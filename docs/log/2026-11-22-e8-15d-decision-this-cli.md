---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/snippets.ts
  - packages/cli/test/tui/snippets.test.ts
supersedes: none
---

**What.** "The PATH's engram resolves to this CLI" means, on Windows, that the first `engram` by PATHEXT is an `.exe` whose real path is the running `process.execPath`; on POSIX, that it is this `main.ts` (by real path) or a script of at most 64 KiB naming its absolute path.

**Why.** The card leaves the test open. No engram `.exe` is built today, so only a packaged binary running the TUI itself is this CLI, and nothing on the PATH is spawned to ask it.

**Result.** snippets.test.ts: a `.cmd` gives node and `main.ts` with ".cmd shim"; an `.exe` that is `execPath` gives `engram`, another gives the absolute form with "is not this CLI"; a POSIX shim naming `main.ts` gives `engram`.

**Consequence.** If wrong, the snippet is the absolute form more often than needed, which still runs as pasted.
