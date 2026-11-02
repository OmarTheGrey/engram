# ADR 0019: Monorepo tooling

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

See the proposal in docs/decisions/README.md.

## Decision

pnpm workspaces; TypeScript 7 (amended 2026-10-17 by the lead: 5.x was outdated, 7.0 is the native compiler); Node 24 (type stripping for scripts, `node:sqlite`); tsdown for published packages; biome for lint and format; vitest and fast-check; `@modelcontextprotocol/sdk` for the MCP server; uv for `research/` with ruff, mypy, pytest, hypothesis; one Makefile over both. CI on GitHub Actions with a service container for each real store. Exact pins for every pi package and benchmark.

Amendments made when deciding:

- TypeScript 7, not 5.x, on the lead's instruction of 2026-10-17. Biome 2.5, Vitest 5, Node 24, pnpm 10 and uv are in use since S0.1; tsdown waits until a package is published.

Amendments made by card E0.4, 2026-10-29 (PR 3 of the Gate A plan):

- No Docker, on the lead's instruction of 2026-10-29: no test, gate, Makefile target or CI job needs Docker, and `scripts/test/no-docker.test.ts` fails if one starts to. The development environment is Node 24, pnpm and uv on the member's machine with the per-user SQLite log (decision D9); `engram doctor` checks it. Postgres for tests comes from the `embedded-postgres` npm package (card E1.1, ADR 0024), not from a service container. The sentence above on "a service container for each real store" is superseded for Postgres; a real store that cannot run in-process is decided by its own card.
- `docker-compose.yml` at the root is for deployment only and says so. What it holds: a `postgres` service (volume, healthcheck) from E0.4; the `server` service with card E8.1 and the `ui` service with card E8.5. `.env.example` names `ENGRAM_DB_URL` and every provider key variable `engram doctor` checks, with no values; `.env` is git-ignored.
- Layer 6 (`make test-e2e`) is a vitest project of its own (`test/e2e/vitest.config.ts`), outside the root config so `make test` never runs it; CI runs it on main and nightly (`.github/workflows/e2e.yml`). It runs doctor and the CLI smoke on SQLite and on the embedded Postgres that core's globalSetup (`packages/core/test/db/global-setup.ts`) starts; the e2e and CLI test projects name that file by relative path rather than moving it, and share one CLI test helper, `packages/cli/test/postgres.ts`, that makes a fresh database per test.
- The provider key variable names reach the CLI as data, `packages/runner/src/model/provider-keys.json`, which `make api` generates from pi-ai's own `findEnvKeys` and `make api-check` and a runner test hold to the installed pi-ai. The CLI never imports pi-ai and gains no dependency on the runner (which would load pi-coding-agent and the extension on every command). `findEnvKeys` is exported only from pi-ai's `compat` entry point, which pi-ai 1.3.0 marks as temporary and to be deleted with the coding-agent ModelManager migration; a pi pin bump that removes it makes `make api` fail, and the replacement is to read the names from `builtinProviders()` (`@earendil-works/pi-ai/providers/all`) or to probe each provider's `auth.apiKey.resolve` with a recording context (comment in `packages/runner/src/model/provider-keys.ts`).

Amendments made by the Gate B plan, 2026-10-29 (`docs/tasks/gate-b-plan.md`, decision 4):

- `docker-compose.yml` gains no `server` or `ui` service with cards E8.1 and E8.5, as the amendment above planned: the server has no authentication yet and listens on loopback only (ADR 0027), so it is not deployable. The services come with the card that adds authentication.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E0.1. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
