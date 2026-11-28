# ADR 0022: Other harnesses through MCP; interception limits stated

Status: accepted with amendments, 2026-11-02; amendment of 2026-11-28 (card E8.17) proposed
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

Amendments proposed by card RV5, 2026-11-20 (findings RV-SRF-6 to RV-SRF-9 of the repository review of the surfaces). Status: proposed, for the lead's acceptance; drafted by the card's agent.

- RV-SRF-6: `engram mcp --http` keeps one server per MCP session (the SDK's stateful streamable HTTP pattern: an initialize request with no `mcp-session-id` starts one, later requests name it, an unknown id is 404, at most 64 sessions are kept and the oldest is closed past that). Before, the stateless transport built a server per request, so memory_simulate replayed an empty workload. Session ids are random UUIDs; they identify a session and authenticate nothing (ADR 0027 decision 4, loopback only).
- RV-SRF-7: over stdio, when the client's input ends, the calls already received are answered before the server closes (up to 30 seconds). Before, their replies were dropped though their writes had committed.
- RV-SRF-8: the hook records every block as source `model` whatever source its actor was given; a test now holds it (`packages/mcp/test/hook.test.ts`).
- RV-SRF-9: `engram hook claude-code --protect <file>` (repeatable) guards a file with its `-wal`, `-shm` and `-journal` files. With `--server` the hook takes no `--db`, so it protected the default log, not the one `engram serve --db` names; a member serving another log passes it here (`docs/dogfood.md`). Asking the server for its log path (in `/health`) was not taken: it would tell any loopback caller where the log lives.
- The hook sends no time with a block (ADR 0027, amendment of RV5).

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E8.4, E8.5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)

Amendment of 2026-11-21, recording answers given on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`), carried by the answers card; the lead may overturn any:

- Item 25: the harness claim is stated as untested. C7, the governed tools without read filtering, equals C5 in benchmark sessions and the other harnesses cannot be seeded, so no hypothesis runs C7; Claude Code and Codex stay supported through MCP and the hook, with the interception limits this ADR states.

Amendment of 2026-11-28, proposed by card E8.17 of the second absorb plan (status: proposed, for the lead's acceptance; drafted by the card's agent). It builds on this ADR's amendments of PR 3, its review fix pass and RV5, on ADR 0014 (core's no-bypass checks), ADR 0027 (the hook calls the generated client, the server stamps the time) and ADR 0037 (the copied schemas). It changes no condition: C7's definition, governed tools without read filtering, stands, and the harness claim stays untested (lead-decisions item 25).

- "Codex has no hook" no longer holds. Codex ships PreToolUse command hooks with generated schemas (`codex-rs/hooks/schema/generated/pre-tool-use.command.input.schema.json` and its output schema at openai/codex `ebd0765aafa2`, copied unmodified under `fixtures/harness/codex/schema/`, Apache-2.0, NOTICE kept). Its deny is Claude Code's shape, `hookSpecificOutput.permissionDecision: "deny"` with `permissionDecisionReason`, read on exit 0 (`codex-rs/hooks/src/events/pre_tool_use.rs`).
- `engram hook codex` answers it with the decider the Claude Code hook uses (`harnessHook` in `packages/mcp/src/hook.ts`): core's shell and path checks, a block recorded as one bypass_blocked event as source `model`, fail closed. Codex's reading of a call: its shell tool is named `Bash` whatever shell runs it, so the command is checked as POSIX and as PowerShell; `apply_patch` carries the patch text in `tool_input.command`, and the paths of its `Add File`, `Update File`, `Delete File` and `Move to` headers are checked (also inside a shell command that applies a patch); any other tool, an MCP tool's arguments included, goes through the path check; the Engram server's `mcp__engram__*` tools are skipped; a null `tool_input`, which Codex's schema allows, is read as no arguments.
- Paths: Codex starts a hook in the session's folder and exports no project variable, so `--root` and a relative `--db` resolve against the hook's own cwd. The guarded files are the log (with its SQLite companions), the project's `.codex/config.toml` and `.codex/hooks.json`, and the Codex home's `config.toml` and `hooks.json` (`$CODEX_HOME`, else `~/.codex`, by core's `codexHomeOf`), with any folder holding one strictly inside the project or the home. The default actor is `agent:codex`.
- `engram hook install claude-code|codex` merges the entry into the one settings file the harness reads (`.claude/settings.json` or, with `--user`, `~/.claude/settings.json`; `.codex/hooks.json` or `$CODEX_HOME/hooks.json`) with `onFailure: "block"`, keeping every other entry. It knows its own entries by their command strings, so a second run replaces rather than duplicates and, when nothing changes, writes nothing. It backs up a file it changes beside it, named by the old content's sha256, and refuses a link, a file that is not regular, or a file that is not JSON or whose hooks have another shape. It never edits TOML: Codex also reads a `[hooks]` table in config.toml, and warns when both hold hooks.
- Residual limits, beside this ADR's: Codex runs a project's hooks only once the user trusts them in `/hooks`, so a project entry blocks nothing until then; a user-level entry has no such step. A word cmd.exe cannot hold safely (`"`, `%`, `!`, `^`, `&`, `|`, `<`, `>`) is refused by the installer. No context injection (SessionStart or UserPromptSubmit) is added: it would give the MCP path a governed read and change C7.
