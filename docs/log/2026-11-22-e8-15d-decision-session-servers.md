---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/serve.ts
  - packages/cli/test/tui/flows-surfaces.test.ts
supersedes: none
---

**What.** A server the Serve or MCP screen starts belongs to the session, one per command: a screen opened again attaches to it, its form filled from the running command line, and offers Stop; the run is recorded once when it ends, with "stopped when the TUI quit" if quitting stopped it.

**Why.** Review finding E8.15d-3: after esc the server kept running but no screen could reach it, and starting again failed with EADDRINUSE. A server list screen would be a second way to the same state.

**Result.** The flow test starts a server, leaves, reopens Serve, sees `[ Stop ]` and the running line, presses `s` and sees the stop line.

**Consequence.** Two servers of one command at once are not offered; the second Start says it is running.
