# ADR 0003: Event log as source of truth; store state as projection; SQLite via node:sqlite

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Eywa keeps SQLite authoritative and treats vector and graph as rebuildable projections; MemSecBench shows in-place repair damages benign memory, so removal must be an event, not a delete; the roadmap's replay-from-events test.

## Decision

Append-only `events` table with dense `seq`, `item_id`, `actor`, `scope`, `op`, `decision`, `reason`, `policy_id`, `ts`; item state is a projection rebuilt by replay. `node:sqlite` behind a 40-line `Db` interface so Postgres or better-sqlite3 is a swap. UUIDv7 for items and events. Every projection has a `rebuild()` and a test that rebuild equals incremental.

Amendments made when deciding:

- Built in S0.8: a Db interface over node:sqlite with savepoint transactions, an `events` table with a dense `seq`, and an item projection updated in the append transaction; `rebuild()` equals the incremental projection over 500 seeded random event sequences.
- Event ids are UUIDv7 supplied by the caller: core reads no clock and draws no randomness.

Amendments made in the review fix pass, 2026-10-25 (PR #6, findings R6-8 and R6-9; pending the lead's review like the rest of this ADR):

- Decision D9: the CLI's default event log is per user, `<home>/.engram/engram.db`, not `.engram/engram.db` under the working directory, so dogfood content never lands inside a repository by default (AGENTS.md rule 12). The home folder comes from the CLI's Io (injected in tests); `--db` still overrides, and `engram doctor` never creates a log.
- The CLI takes every id it injects into the Plane from its Io (`newId`), so a run with a fixed Io is reproducible.

Amendment made by card E1.1, 2026-10-29 (pending the lead's review like the rest of this ADR):

- The Postgres swap this ADR left unbuilt is ADR 0024: the `Db` interface stays synchronous and gains a `dialect`; `openPostgres(url)` runs it on a worker thread; the contract both backends pass is `packages/core/test/db/contract.ts`. SQLite stays the default.

## Alternatives considered

Storage: (a) `node:sqlite` (unflagged since Node 22.13 and 23.4, release candidate as of 25.7, no native build, prepared statements, extension loading opt-in, transactions via `exec`); (b) `better-sqlite3` (mature, native build); (c) libsql. Identity: UUIDv7 or ULID.

## Consequences

Unblocks E1.1, E1.2, replay tests, the policy simulator. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
