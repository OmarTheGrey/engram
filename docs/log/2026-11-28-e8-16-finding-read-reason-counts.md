---
date: 2026-11-28
author: claude-agent
type: finding
card: E8.16
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage.test.ts
supersedes: none
---

**What.** The read event's reason, which the HTTP API, the CLI and the TUI return to the reader, counts the projected items outside the reader's reach (`11 projected items outside the reader's reach were not candidates` for a non-member on the canary workspace, 0 on an empty one), and how many grants to it expired or lost their class.

**Why.** No canary leaks, but the count tells a non-member how many items the log holds. MCP keeps the reason from the model; pi's session record holds it.

**Result.** Pinned as `read (reason counts)` in the HTTP suite's ORACLES.

**Consequence.** Decision D5 put the counts in the reason on purpose; whether a non-member should see them is the lead's question.
