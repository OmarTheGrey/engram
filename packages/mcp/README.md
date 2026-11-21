# @engram/mcp

How Claude Code and Codex reach the plane (ADR [0022](../../docs/decisions/0022-other-harnesses-through-mcp.md)): an MCP server with the same governed tools pi has, and a Claude Code PreToolUse hook that blocks direct store access. pi stays the reference harness; these are the supported others. Back to the [root README](../../README.md).

## Rules

- **Every call is one fixed actor, labelled source `model`** (decision D4 of ADR [0004](../../docs/decisions/0004-provenance-and-source-trust.md)). The actor is named at launch (`--as`, `--member`), not by the model.
- **The server holds no policy logic.** Each tool call is one call of the generated client (`@engram/sdk`) to the HTTP API's route table, in process or to a running `engram serve`.
- **Loopback only.** The streamable HTTP transport binds to 127.0.0.1 and runs behind the HTTP API's loopback guard (Host, Origin, JSON bodies only). There is no authentication yet (ADR [0027](../../docs/decisions/0027-http-contract-client-and-inspector.md)).
- **The hook fails closed.** A block whose event cannot be recorded is still a deny, and an input that is not a PreToolUse object is denied.
- **The limits are stated, not hidden.** Every `memory_read` through this server is filtered by scope and grants like any other read. What nothing on this path governs is what the harness already holds in its context: MCP has no equivalent of pi's `context` handler, so a harness here gets governed tools without the context filter (condition C7). Codex has no hook, so a store command is not blocked there. A hook cannot see a store reached through a path or a name a command computes at run time.

## Main modules

| module | what it holds |
|---|---|
| `src/server.ts` | `createMcpServer(options)` and `toolList()`: the tools `memory_write`, `memory_read`, `memory_explain` and `memory_simulate`, with the definitions and wording of `@engram/pi-extension/tools`, so the model sees the same tools on every path; `memory_simulate` replays the calls this server made |
| `src/transports.ts` | `serveStdio` (Claude Code and Codex launch it as a child process) and `serveHttp` (streamable HTTP on a loopback port, one server per MCP session, sessions capped and expired) |
| `src/hook.ts` | `claudeCodeHook`: reads Claude Code's PreToolUse JSON on stdin, denies a Bash or PowerShell command that names a store and a file tool on a path inside a store root, guards the log, `.mcp.json` and `.claude/settings*.json`, and records each block as one `bypass_blocked` event. The checks are core's `shellBypass` and `toolBypass`, the same as the pi extension's |

## Use

Through the CLI:

```sh
engram mcp --as person:dana --member person:dana --root memory --owner dana          # stdio
engram mcp --as person:dana --member person:dana --root memory --owner dana --http 7314   # streamable HTTP on loopback
engram hook claude-code --root "$CLAUDE_PROJECT_DIR/memory" --as person:dana          # the hook, reading stdin
```

Working project configurations are in [`fixtures/harness/`](../../fixtures/harness/README.md): `claude-code/.mcp.json` and `claude-code/.claude/settings.json` (the server and the hook on every tool), and `codex/config.toml` (the server only). With `engram serve` running, give `--server <url>` in place of the workspace flags (`--root`, `--owner`, `--db`, `--policy`), since the server's own flags name the workspace; the hook then also needs `--protect <file>` naming the log the server writes, which it cannot infer.

## Test

```sh
pnpm --filter mcp exec vitest run
make test-e2e        # builds the inspector and needs Chromium (pnpm exec playwright install chromium); includes the handshake from both fixtures and the hook
```

`test/mcp.test.ts` covers the tools and their results, `test/hook.test.ts` the hook's blocks, `test/sessions.test.ts` the HTTP sessions, `test/mcp.test.ts` also that explain refuses another actor's read id (only a read's maker may explain it), `test/explain-audit.test.ts` that neither `memory_read` nor `memory_explain` carries the audit counts of items out of the reader's reach, and `test/rv5.test.ts` the review fixes of card RV5. The end-to-end test `test/e2e/mcp.e2e.test.ts` launches each fixture's command and runs initialize, list tools, a write, a read and explain.

## What is next

- Card E8.12 (verified actors, in progress): `engram serve` and the HTTP MCP transport become an OAuth 2.1 resource server with audience-bound tokens, plus hashed API keys; stdio keeps `--as`. An ADR comes first.
- Card L6 (in progress): its supersession proposals are applied through the CLI and this server as ordinary governed updates.
