---
date: 2026-11-26
author: claude-agent
type: change
card: E8.15
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/snippets.test.ts
  - packages/cli/test/tui/flows.test.ts
  - docs/design/screens/mcp.ansi
  - docs/design/screens/explain.ansi
supersedes: none
---

**What.** Two README review items. The MCP screen's Codex snippet named `--as agent:claude-code`; it now names `agent:codex` where that default stands. The explain screen said "1 projected item ... was not candidates"; it now says "was not a candidate".

**Why.** A Codex session must not be recorded as Claude Code. The harness fixtures both act as `person:dana`, so they name no agent to copy.

**Result.** `codexArgv` and `reachLine` are each pinned by a test. The four MCP frames at 120x40 changed in the Codex table alone. `make tui-screens` changed `mcp` and `explain` only, by those two strings. Core's read reason (`packages/core/src/plane/read-reason.ts`) still writes "1 projected item ... were not candidates". That was left alone and reported, since changing it could move registered bytes.

**Consequence.** The core wording is a separate card, after the H1 runs.
