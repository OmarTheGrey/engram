---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - test/e2e/tui.e2e.test.ts
  - packages/cli/src/tui/main.ts
supersedes: none
---

**What.** L switched to line mode in the same process at first, and on ConPTY the first line typed was lost; reading with readline's own raw editing instead kept the process alive after quit until a key came.

**Why.** The L smoke failed. Probes outside the repository isolated it: after raw mode and a pause, a stdin resumed later in line input loses its first line, and a raw reading closed after it leaves a read pending; plain Node raw mode does it too, not only pi-tui (libuv's Windows console).

**Result.** Fixed by the child process of the l-child decision; the probe's child variant read every line and both processes exited.

**Consequence.** The in-process switch remains for an injected terminal only.
