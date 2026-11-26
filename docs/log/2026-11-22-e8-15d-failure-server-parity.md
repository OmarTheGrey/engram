---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/parity-surfaces.test.ts
supersedes: none
---

**What.** The first run of the server-mode parity failed for lint and simulate: the plain command exited 1 where the TUI exited 0.

**Why.** The plain side's server was opened on the port the TUI's had just closed, and the client's pooled connection to the first server did not survive it, as E8.15a's review had seen after back-to-back servers.

**Result.** Each side has a server on a port of its own; the plain command line names its own server, and the comparison folds the ports. 22 of 22 pass, twice in a row.

**Consequence.** Nothing further.
