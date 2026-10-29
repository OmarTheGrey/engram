# ADR 0022: Other harnesses through MCP; interception limits stated

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

ADR 0001; Claude Code hooks can block tool calls but cannot transform context; Codex has MCP only.

## Decision

The MCP server exposes the four governed tools and `simulate`. Claude Code additionally gets a hook configuration that blocks store commands. The thesis reports "governed tools without read filtering" as its own condition so the H4 claim is honest about what the MCP path cannot do.

Amendments made when deciding:

- Registered as condition C7 in pre-registration v0.

Amendments made in PR 3 of the plan (card E8.4; branch gb-pr3-surfaces, 2026-10-29; pending the lead's review like the rest of this ADR):

- The MCP server ships as `engram mcp` (packages/mcp, `@modelcontextprotocol/sdk` 1.32.1): the four tools `memory_write`, `memory_read`, `memory_explain` and `memory_simulate` (a tool error naming E8.9 until it lands), with the pi extension's names, descriptions and write wording imported from packages/pi-extension/src/tools.ts, and reads rendered in the shared memory tag (tag.ts). Neither file loads pi at run time, which a test checks by recording every module the server resolves. It uses the SDK's low-level Server, since McpServer would want the TypeBox schemas restated in Zod.
- Identity (plan decision 6): `--as` and `--member` fix the actor at launch; every call is made with source `model`; no tool parameter names an actor, a source or a provenance kind, and arguments that try are ignored. Unlike the pi extension, an MCP write runs no retention sweep after it lands (the write's own budget check still runs in the Plane, and expired items are excluded at read either way).
- Transports: stdio, and streamable HTTP (`--http <port>`) on 127.0.0.1 behind the HTTP API's loopback guard (Host and Origin), stateless with JSON responses. Each HTTP request gets its own server, so memory_simulate's workload there is the events of one request.
- The Claude Code hook ships as `engram hook claude-code`, a PreToolUse command hook (format checked against the Claude Code hooks documentation on 2026-10-29: `tool_name`, `tool_input` and `cwd` on stdin; a deny is exit 0 with `hookSpecificOutput.permissionDecision: "deny"` and `permissionDecisionReason`). It blocks a Bash command naming a store and a file tool on a path inside a `--root` with core's checks, records each block as a bypass_blocked event through the client, and skips the Engram server's own `mcp__engram__*` tools. It fails closed: a block it cannot record is still a deny, and an input it cannot read is denied; any other call gets no output. Claude Code lets a call through on any exit code but 0 and 2, so the hook exits 0 and puts its decision in the JSON.
- Fixtures: `fixtures/harness/claude-code` (`.mcp.json`, and the hook in `.claude/settings.json`) and `fixtures/harness/codex/config.toml`; `make test-e2e` runs the handshake from both and the hook. Codex has no hook, so on that path store commands are not blocked; condition C7 already states that the MCP path is governed tools without read filtering.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E8.4, E8.5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
