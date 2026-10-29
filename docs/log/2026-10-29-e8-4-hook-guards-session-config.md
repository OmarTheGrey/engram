---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook.ts
  - packages/cli/test/hook.test.ts
  - fixtures/harness/README.md
  - docs/decisions/0022-other-harnesses-through-mcp.md
supersedes: none
---

**What.** Review finding R3-2: the hook always guards the files that govern the session, the event log (and SQLite's sidecar files), `.mcp.json` and `.claude/settings*.json`, and the fixtures move the log out of the project to the per-user default (decision D9).

**Why.** The model could edit its MCP launch identity, remove the hook, or delete the log with Claude Code's own tools.

**Result.** Editing `.mcp.json` or `.claude/settings.json` and `rm` of the log are denied as store `engram` and recorded; dropping the protected list failed 6 tests in packages/mcp and 1 in packages/cli. The residual limit (computed paths, user and managed settings, changes outside Claude Code's tools) is in ADR 0022.

**Consequence.** A project that keeps its log inside itself is still guarded, since the hook protects whatever log it writes.
