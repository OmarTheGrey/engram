---
date: 2026-11-28
author: claude-agent
type: change
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage-kit.ts
  - packages/server/test/leakage.test.ts
  - packages/mcp/test/leakage.test.ts
  - packages/cli/test/parity.test.ts
  - packages/mcp/test/leakage-agent.ts
supersedes: none
---

**What.** The scanner also looks for a canary's id without dashes, its content's sha256 and the plane's two content hashes, its content's tail and the nonce or content in base64, in any case; it reads the HTTP headers, every MCP content block and structured content, and the TUI's pages to the last one.

**Why.** Review finding 6: hashes are the realistic shape (lint reasons and erase events carry them).

**Result.** No new leak; a scanner test feeds each shape and finds it. The TUI loop fails if 60 pages pass without an end.

**Consequence.** Shapes beyond these (a split nonce, a short prefix) remain out of reach, stated in the result's limits.
