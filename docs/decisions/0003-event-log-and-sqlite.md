# ADR 0003: Event log as source of truth; store state as projection; SQLite via node:sqlite

Status: accepted with amendments, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Eywa keeps SQLite authoritative and treats vector and graph as rebuildable projections; MemSecBench shows in-place repair damages benign memory, so removal must be an event, not a delete; the roadmap's replay-from-events test.

## Decision

Append-only `events` table with dense `seq`, `item_id`, `actor`, `scope`, `op`, `decision`, `reason`, `policy_id`, `ts`; item state is a projection rebuilt by replay. `node:sqlite` behind a 40-line `Db` interface so Postgres or better-sqlite3 is a swap. UUIDv7 for items and events. Every projection has a `rebuild()` and a test that rebuild equals incremental.

Amendments made when deciding:

- Built in S0.8: a Db interface over node:sqlite with savepoint transactions, an `events` table with a dense `seq`, and an item projection updated in the append transaction; `rebuild()` equals the incremental projection over 500 seeded random event sequences.
- Event ids are UUIDv7 supplied by the caller: core reads no clock and draws no randomness.

## Alternatives considered

Storage: (a) `node:sqlite` (unflagged since Node 22.13 and 23.4, release candidate as of 25.7, no native build, prepared statements, extension loading opt-in, transactions via `exec`); (b) `better-sqlite3` (mature, native build); (c) libsql. Identity: UUIDv7 or ULID.

## Consequences

Unblocks E1.1, E1.2, replay tests, the policy simulator. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
