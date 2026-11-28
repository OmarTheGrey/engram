---
date: 2026-11-28
author: claude-agent
type: change
card: A6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/mcp-memory/index.ts
  - packages/adapters/test/mcp-memory/mcp-memory.test.ts
  - make test-one T=packages/adapters/test/conformance/conformance.test.ts
supersedes: none
---

**What.** A fourth adapter, `mcp-memory`, over the knowledge-graph JSONL file of `@modelcontextprotocol/server-memory` 2.2.1 (format ported at `c799c8552b0f`, no code copied), registered in the conformance suite.

**Why.** It is the memory most MCP users run, and a fourth store behind one contract widens the design property H4 rests on (ADR 0035).

**Result.** The conformance run passes 291 cases and skips 41, the mcp-memory entry passing 40 and the lexical recall case, skipping the same 7 capability-gated cases as the files adapter (no history, no native validity); the adapter's own file passes 20 and skips 1 (permission bits, POSIX only). Mutation checks: writing a fresh record instead of the old one's members fails 2 tests; dropping an unreadable line fails 2.

**Consequence.** `--store mcp-memory` can open it (a change entry of its own).
