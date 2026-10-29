# Harness fixtures (card E8.4)

How Claude Code and Codex reach Engram, as a project would configure them. `make test-e2e` (`test/e2e/mcp.e2e.test.ts`) copies each folder to a temporary directory, launches the `engram mcp` command it names (with `engram` replaced by `node packages/cli/src/main.ts`), and runs the MCP handshake: initialize, list tools, a write, a read, and explain on that read.

- `claude-code/.mcp.json`: the MCP server, launched over stdio as `person:dana` with source `model` (plan decision 6).
- `claude-code/.claude/settings.json`: the PreToolUse hook `engram hook claude-code`, which blocks a Bash command naming a store and a file tool on a path inside `memory/` (ADR 0022).
- `codex/config.toml`: the same MCP server under `[mcp_servers.engram]`. Codex has no hook, so a store command is not blocked on that path (condition C7).

Each `memory/` folder holds one Claude Code memory file, adopted through the plane on the first read.
