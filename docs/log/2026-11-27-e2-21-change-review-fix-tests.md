---
date: 2026-11-27
author: claude-agent
type: change
card: E2.21
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/mcp.test.ts
  - packages/pi-extension/test/surface.test.ts
  - packages/server/test/errors.test.ts
supersedes: none
---

**What.** The review's test findings on part 1 fixed: E221-1 and E221-2 (from the paused WIP commit, finished) and E221-5's strictness check.

**Why.** The MCP test saw only the default tool list and top-level parameters; the pi extension was covered by inference; the OpenAPI check passed a non-strict `PromoteRequest`.

**Result.** The MCP test walks `toolList(true)`, so `memory_supersede` is included, and every schema key at any depth. A new pi-extension test collects every tool the extension registers. The server test asserts `additionalProperties` false on the committed `PromoteRequest`. Mutations, each restored: a nested `replay` on `memory_supersede` fails with "memory_supersede: expected [ 'type', 'required', ... ] to not include 'replay'"; `additionalProperties: true` in `sdk/openapi.json` fails with "expected true to be false". After merging main: write-grants 31, errors 8, promote 10, mcp 16, surface 2, all passing.

**Consequence.** A surface exposing `replay` fails a test on purpose.
