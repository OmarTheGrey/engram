---
date: 2026-11-28
author: claude-agent
type: change
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage.test.ts
  - packages/mcp/test/leakage.test.ts
  - packages/cli/test/parity.test.ts
supersedes: none
---

**What.** The positive control (lee, a member of team:x) now runs every probe on every surface and must be shown a team canary on each listing or by-id output: read, read by id, events and export over HTTP, the CLI and the TUI, memory_read and memory_explain over MCP; the TUI's two views must show each actor the canaries the CLI's read shows it.

**Why.** Review finding 5: a zero on a route the control never reached proves nothing.

**Result.** Every control check passes; its probes (and the erasing member's) are counted apart in the result.

**Consequence.** A route that stopped returning items would fail its control, not pass as clean.
