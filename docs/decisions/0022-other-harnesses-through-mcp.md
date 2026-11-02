# ADR 0022: Other harnesses through MCP; interception limits stated

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

ADR 0001; Claude Code hooks can block tool calls but cannot transform context; Codex has MCP only.

## Decision

The MCP server exposes the four governed tools and `simulate`. Claude Code additionally gets a hook configuration that blocks store commands. The thesis reports "governed tools without read filtering" as its own condition so the H4 claim is honest about what the MCP path cannot do.

Amendments made when deciding:

- Registered as condition C7 in pre-registration v0.

Amendments made in PR 3 of the plan (card E8.4; branch gb-pr3-surfaces, 2026-10-29):

- The MCP server ships as `engram mcp` (packages/mcp, `@modelcontextprotocol/sdk` 1.32.1): the four tools `memory_write`, `memory_read`, `memory_explain` and `memory_simulate` (a tool error naming E8.9 until it lands), with the pi extension's names, descriptions and write wording imported from packages/pi-extension/src/tools.ts, and reads rendered in the shared memory tag (tag.ts). Neither file loads pi at run time, which a test checks by recording every module the server resolves. It uses the SDK's low-level `Server` class, which version 1.32 marks deprecated in favour of `McpServer` ("only use Server for advanced use cases"): McpServer takes Zod schemas, so using it would restate the TypeBox parameter schemas a second time and break the one definition the pi extension and the MCP server share. If a later SDK removes `Server`, the tool list moves to McpServer built from the same JSON Schemas.
- Identity (plan decision 6): `--as` and `--member` fix the actor at launch; every call is made with source `model`; no tool parameter names an actor, a source or a provenance kind, and arguments that try are ignored. Unlike the pi extension, an MCP write runs no retention sweep after it lands (the write's own budget check still runs in the Plane, and expired items are excluded at read either way).
- Transports: stdio, and streamable HTTP (`--http <port>`) on 127.0.0.1 behind the HTTP API's loopback guard (Host and Origin), stateless with JSON responses. Each HTTP request gets its own server, so memory_simulate's workload there is the events of one request.
- The Claude Code hook ships as `engram hook claude-code`, a PreToolUse command hook (format checked against the Claude Code hooks documentation on 2026-10-29: `tool_name`, `tool_input` and `cwd` on stdin; a deny is exit 0 with `hookSpecificOutput.permissionDecision: "deny"` and `permissionDecisionReason`). It blocks a Bash command naming a store and a file tool on a path inside a `--root` with core's checks, records each block as a bypass_blocked event through the client, and skips the Engram server's own `mcp__engram__*` tools. It fails closed: a block it cannot record is still a deny, and an input it cannot read is denied; any other call gets no output. Claude Code lets a call through on any exit code but 0 and 2, so the hook exits 0 and puts its decision in the JSON.
- Fixtures: `fixtures/harness/claude-code` (`.mcp.json`, and the hook in `.claude/settings.json`) and `fixtures/harness/codex/config.toml`; `make test-e2e` runs the handshake from both and the hook. Codex has no hook, so on that path store commands are not blocked; condition C7 already states that the MCP path is governed tools without read filtering.

Amendments made in the review fix pass of PR 3 (findings R3-1, R3-2, R3-6, R3-8, R3-10; 2026-10-29):

- The hook runs the shell check for any tool named Bash or PowerShell, in any case, and the fixture's matcher is `*`, so every tool reaches it and core decides (R3-1).
- The hook also guards the files that govern the session (R3-2): the log it writes to (with SQLite's `-wal`, `-shm` and `-journal` files), the project's `.mcp.json` (the MCP server's launch identity) and `.claude/settings.json` and `.claude/settings.local.json` (the hook itself), for file tools and shell commands alike, reported as store `engram`. The fixtures name no `--db`, so the log is the per-user default `<home>/.engram/engram.db` (decision D9), outside the project. Verification follow-up (findings R3-13 and R3-14): a folder holding one of these files strictly inside the project or the home folder is guarded too (`rm -rf ~/.engram`, `rm -rf .claude`, `mv .claude x`), and so are the user-level `~/.claude/settings.json`, `~/.claude/settings.local.json` and `~/.claude.json`, since a user-level `disableAllHooks: true` would switch the hook off. Residual limit: the guard is the hook's own text and path check, so a command that computes a path at run time, a program the model writes and runs, a managed (enterprise) settings file, a settings file named by `--settings` on another launch, the project or home folder removed as a whole (they are not hits, or every command in them would be), and any change made outside Claude Code's tools are out of its reach; and if the model can run `claude` itself with other flags, the hook does not govern that session.
- Input that is not a PreToolUse object (`null`, an array, a string, a non-object `tool_input`) is denied, and any error while deciding is a deny printed on stdout with exit 0 (R3-6).
- The hook's default actor is `agent:claude-code` with no memberships, so its block events are visible only to that id; the fixture passes `--as person:dana`, so the session owner sees them in the timeline (R3-8).
- `--root` and a relative `--db` resolve against `$CLAUDE_PROJECT_DIR`, else the input's `cwd`, else the hook's cwd, and the fixture names its root as `${CLAUDE_PROJECT_DIR}/memory` in exec form (R3-10).

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E8.4, E8.5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
