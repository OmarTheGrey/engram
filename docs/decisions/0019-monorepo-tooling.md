# ADR 0019: Monorepo tooling

Status: accepted with amendments, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

See the proposal in docs/decisions/README.md.

## Decision

pnpm workspaces; TypeScript 7 (amended 2026-10-17 by the lead: 5.x was outdated, 7.0 is the native compiler); Node 24 (type stripping for scripts, `node:sqlite`); tsdown for published packages; biome for lint and format; vitest and fast-check; `@modelcontextprotocol/sdk` for the MCP server; uv for `research/` with ruff, mypy, pytest, hypothesis; one Makefile over both. CI on GitHub Actions with a service container for each real store. Exact pins for every pi package and benchmark.

Amendments made when deciding:

- TypeScript 7, not 5.x, on the lead's instruction of 2026-10-17. Biome 2.5, Vitest 5, Node 24, pnpm 10 and uv are in use since S0.1; tsdown waits until a package is published.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E0.1. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
