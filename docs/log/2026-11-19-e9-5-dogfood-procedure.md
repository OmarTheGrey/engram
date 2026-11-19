---
date: 2026-11-19
author: claude-agent
type: change
card: E9.5
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - docs/dogfood.md
  - docs/tasks/E9.5.md
  - fixtures/harness/claude-code/.mcp.json
supersedes: none
---

**What.** `docs/dogfood.md` gains the twin dogfood's procedure: when it starts, the known limits, setup, the server, Claude Code's MCP server and hook, each day's writes, grants and reads, what never to do, the report and what to send.

**Why.** The two weeks are run by three members on their own machines; each needs the exact commands and the limits before starting.

**Result.** A smoke run of the procedure's commands on a scratch copy of `fixtures/stores/claude-code-memory` (serve under the twin profile, a CLI write and reads through `--server`, a grant added and removed through `POST /api/v1/grants`, the report on the log): the grantee read 1 item, then 0; the report printed 11 events, 1 grant added, 1 removed, 0 violations, exit 0. The Gate A record stays below it.

**Consequence.** Card E9.5's status line: the kit is ready; the two weeks wait on the lead's go.
