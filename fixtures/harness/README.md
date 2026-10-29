# Harness fixtures (card E8.4)

How Claude Code and Codex reach Engram, as a project would configure them. `make test-e2e` (`test/e2e/mcp.e2e.test.ts`) copies each folder to a temporary directory, launches the `engram mcp` command it names (with `engram` replaced by `node packages/cli/src/main.ts`), and runs the MCP handshake: initialize, list tools, a write, a read, and explain on that read.

- `claude-code/.mcp.json`: the MCP server, launched over stdio as `person:dana` with source `model` (plan decision 6).
- `claude-code/.claude/settings.json`: the PreToolUse hook `engram hook claude-code` on every tool (matcher `*`), in exec form with `${CLAUDE_PROJECT_DIR}/memory` as the store root and `--as person:dana`, so its block events are dana's to see. It denies a shell command (Bash or PowerShell) naming a store, a file tool on a path inside `memory/`, and any edit of `.mcp.json`, `.claude/settings*.json` or the event log (ADR 0022 amendments).
- `codex/config.toml`: the same MCP server under `[mcp_servers.engram]`. Codex has no hook, so a store command is not blocked on that path (condition C7).

Neither names `--db`: the log is the per-user default, `<home>/.engram/engram.db` (decision D9), outside the project the model edits. Each `memory/` folder holds one Claude Code memory file, adopted through the plane on the first read.
