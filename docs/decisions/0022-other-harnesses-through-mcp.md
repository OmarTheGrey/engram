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

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E8.4, E8.5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
