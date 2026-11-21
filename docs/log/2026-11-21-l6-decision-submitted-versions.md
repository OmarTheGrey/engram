---
date: 2026-11-21
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/L6.md
  - packages/core/src/supersede.ts
supersedes: none
---

**What.** The route also returns `submitted`, the version each accepted close sent to the gate.

**Why.** A deny event carries no item, so the MCP server could not otherwise record a denied close for memory_simulate's replay.

**Result.** The simulate test in packages/mcp/test/supersede.test.ts.

**Consequence.** None.
