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

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks PX1, Gate A check. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
