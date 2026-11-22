---
date: 2026-11-22
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/contract.ts
  - packages/mcp/src/server.ts
supersedes: none
---

**What.** `submitted` keeps the full version of every accepted close sent, whether allowed, denied or refused by the store, rather than ids and versions only.

**Why.** After L6-1, every close is a version of an item `evaluateRead` admitted for the actor at `at`, so it carries no body the reader could not read. The MCP server needs the body to replay a denied close in `memory_simulate`.

**Result.** packages/server/test/supersede.test.ts: no hidden content in any answer.

**Consequence.** If the lead wants ids only, memory_simulate loses its replay of denied closes.
