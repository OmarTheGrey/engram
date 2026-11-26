---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/snippets.ts
  - packages/cli/test/tui/snippets.test.ts
  - "make test-one T=packages/cli/test/tui/snippets.test.ts"
supersedes: none
---

**What.** `packages/cli/src/tui/snippets.ts` builds the hook entry, `.mcp.json` and Codex's `config.toml` in the fixtures' exact shape, resolves their command, and runs Try it.

**Why.** docs/design/tui.md 8.14 and 8.15: a pasted hook that cannot start fails open, and Try it must touch neither the workspace's log nor a server.

**Result.** The command is `engram` only when the PATH's first engram is this CLI and, on Windows, an `.exe`; else node and the absolute `main.ts`, with the reason. Roots, protected files and a SQLite `--db` are absolute. Try it spawns the copied command with `--db` and `--server` replaced by `--db :memory:`, the export flags dropped, `ENGRAM_DB_URL=:memory:` set and the server, token and export variables removed, each listed; it shows each sample's exit code, and a command that does not start, or exits 127, as "the hook did not run". 17 tests pass.

**Consequence.** The hook and MCP screens use it.
