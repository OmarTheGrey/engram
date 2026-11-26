---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
supersedes: none
---

**What.** The command table was an object literal, so `engram toString` looked up Object's method as a handler; the registry's table has no prototype.

**Why.** Found while building the table from the registry.

**Result.** `engram toString` is now an unknown command, exit 2, as any unknown word; no test pinned the old behaviour, which returned a string as an exit code.

**Consequence.** None for scripts; noted because it is the one output change outside 12.2.
