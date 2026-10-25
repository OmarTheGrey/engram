# ADR 0014: No-bypass: store commands blocked in bash; MCP store tools wrapped

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Invariant 2 is meaningless if an agent can write to the store from a shell; MPBench's write channels include tool outputs.

## Decision

The extension's `user_bash` and `tool_call` handlers block a configured list of store commands and endpoints (`mem0`, `letta`, direct file writes under adapter roots) and route them through the Engram tools. MCP tools that reach a store are wrapped so their calls pass the gate. A blocked bypass is an event.

Amendments made when deciding:

- Amended from S0.5: pi emits user_bash only for the user's `!` commands and only from its interactive and RPC hosts, so the model's bash tool is gated in tool_call with the same command list and the runner emits user_bash itself.
- user_bash cannot block a command, so a block is a replacement result with exit code 126, recorded as an event.

Amendments made in the review fix pass, 2026-10-25 (PR #7, findings R7-1 to R7-15; pending the lead's review like the rest of this ADR):

- Decision D10 (finding R7-1): shell text cannot be parsed into a complete answer, so the check errs towards blocking. A command is a store command if any word of it, after removing quotes, a leading path, an executable suffix (`.exe`, `.cmd` and the like) and case, and on either side of an `=`, is a known store name (`mem0`, `letta`), wherever it stands: behind wrappers (env, sudo, exec, time, xargs, npx, uvx, `pnpm dlx`, `python -m`), inside `bash -c` and `sh -c` arguments, subshells, braces, `$()`, backticks, and after `&`, `;`, `|`, `&&`, `||`. The check runs for user_bash and for the model's bash and powershell tools. Mentions that would not run the store (`echo mem0`) are blocked too; that is the cost of erring this way.
- Decision D10: pi's file tools (read, write, edit, grep, find, ls) and any tool with a path argument are blocked, as a `Plane.recordBypass` event with policy_id `engram/bypass/store-path`, on a path that resolves inside a configured store root (realpath of the path or its nearest existing ancestor, else the normalised absolute path, without case on Windows). grep and find are also blocked when a root lies inside the directory they search. A shell command word that is such a path is blocked the same way.
- Limit, recorded as D10 asks: a store name that a variable, an alias, a function or a script supplies at run time (`$STORE add x`, `$(printf mem%s 0)`), and a shell command that reaches a root through a path it computes, are out of reach of any text check. The extension's header comment says the same; nothing more is claimed.
- Finding R7-9: `Plane.recordBypass` keeps what was attempted in the event's reason (`...; attempted: <command>`), on one line, cut to 160 characters, with values that look like secrets (`NAME_KEY=`, `--token`, `Bearer`, URL credentials, `sk-` and long key-like strings) replaced by `<redacted>`. It refuses an invalid actor, time or bypass with `InvalidCallError`, as every other Plane call does (decision D6). A bypass has a route: `command` (`engram/bypass/store-command`), `path` (`engram/bypass/store-path`) and `result` (`engram/bypass/foreign-result`, decision D11, see ADR 0009).

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks PX1, Gate A check. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
