---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/dogfood.md
  - packages/cli/src/mcp.ts
supersedes: none
---

**What.** Every surface reaches the dogfood's log through `engram serve`: `engram mcp`, the hook and the CLI are given `--server http://127.0.0.1:7313`; pi, which opens the log itself, is optional and used only once card E2.6 merges.

**Why.** The race between two processes on one log is open until E2.6 (ADR 0034, decision 5); one process on the log keeps the write queue's ordering for every write.

**Result.** The procedure's MCP and hook configurations name `--server`; the never list forbids any command left on the default log while the server runs.

**Consequence.** After E2.6, a second process is safe and the rule can be relaxed.
