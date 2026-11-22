---
date: 2026-11-21
author: claude-agent
type: decision
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/L6.md
  - packages/core/src/supersede.ts
supersedes: none
---

**What.** `engram supersede` exits 0 when the chain resolves and every accepted close was allowed, 1 on an unresolved chain, a write not allowed, or the server's 400, and 2 on bad usage.

**Why.** This follows the CLI's convention that a refused call is a CallError, exit 1.

**Result.** packages/cli/test/supersede.test.ts.

**Consequence.** None.
