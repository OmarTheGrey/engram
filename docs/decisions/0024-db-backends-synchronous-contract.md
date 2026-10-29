# ADR 0024: Db backends: one synchronous contract, SQLite per user by default, Postgres on a worker thread

Status: accepted, pending lead review, 2026-10-29
Deciders: drafted by the orchestrating session on the lead's instruction (plan `docs/tasks/gate-a-e0-e1-e2-plan.md`, decision 2); pending review and acceptance by Omar (lead). Until then this records the design card E1.1's remaining work follows.
Supersedes: nothing; it completes ADR 0003, which left the Postgres swap unbuilt.

## Context

ADR 0003 put node:sqlite behind a 40-line `Db` interface "so Postgres or better-sqlite3 is a swap". The interface is synchronous: `transaction` takes a synchronous body and nests as savepoints, `appendEvent` runs the projection in the append transaction, the read path takes the projection in one synchronous step (decision D5), and the write queue of decision N2 (ADR 0007 amendments) relies on a write deciding and landing without a yield between its projection read and its event. Node has no synchronous Postgres driver. Card E1.1 names SQLite and Postgres backends; the thesis needs the per-user SQLite log (decision D9) and the runner's in-memory log; a shared Postgres log is a product need that arrives with the HTTP server (E8.1) and the inspector.

## Decision

1. The `Db` contract stays synchronous and is made explicit as a test suite, `packages/core/test/db/contract.ts`, that every backend must pass: `exec`, `prepare` with every `Param` type, `run` changes, `get` and `all` row shapes, nested transactions as savepoints, rollback on throw, the synchronous-body rule, and the event, item and replay tests run through a backend factory.
2. The Postgres backend, `openPostgres(url)` in `packages/core/src/db/postgres.ts`, runs its statements on a worker thread that holds the connection; the main thread posts the statement and waits on `Atomics.wait` over a `SharedArrayBuffer` with a timeout that throws `DbTimeoutError` (the synckit pattern). Core does not change. `BEGIN`, `SAVEPOINT`, `RELEASE` and `ROLLBACK TO` run as statements on that connection; the outer transaction takes `pg_advisory_xact_lock` on a key derived from the log, which gives the log the property `BEGIN IMMEDIATE` gives it on SQLite and serialises writers in different processes, which SQLite's write queue does not (ADR 0007 amendments). `?` placeholders are rewritten to `$n`; `bigint` and `Uint8Array` are mapped both ways. Migrations stay one list; the SQLite-only text (`PRAGMA`, `ON CONFLICT ... DO UPDATE`) sits behind a `dialect` the backend reports.
3. SQLite per user (`<home>/.engram/engram.db`) stays the default of every surface; Postgres is chosen by `ENGRAM_DB_URL` or `--db postgres://...`, opened through one `openDb(target)` in the CLI's setup, which the extension reuses.
4. CI runs the contract on both backends with a `postgres:17` service container, skipping Postgres cleanly, with the reason printed, when `ENGRAM_PG_URL` is unset; `docker compose up -d postgres` (card E0.4) provides it locally. Layer 6 (`make test-e2e`) runs `engram doctor` and the CLI smoke on both.

Amendments made by card E1.1, 2026-10-29 (branch `pr-e1-1-postgres`; pending the lead's review like the rest of this ADR):

- No Docker, on the lead's instruction of 2026-10-29: decision 4's `postgres:17` service container and the compose dependency are replaced by `embedded-postgres` (a dev dependency, exact-pinned): `packages/core/test/db/global-setup.ts` starts one throwaway Postgres 17 server per test run on a free port in a temporary data directory and stops it after, on Windows and on CI's Linux alike. `ENGRAM_PG_URL` names an existing server instead; `ENGRAM_PG=skip` skips the Postgres runs; when the server cannot start, the runs skip with the reason printed, except under CI, where the run fails.
- The `Db` interface gains `readonly dialect: "sqlite" | "postgres"`; a migration's `up` is either shared text or one text per dialect. On Postgres, `seq` is `BIGINT` and ids are `TEXT COLLATE "C"`, so `ORDER BY id` agrees with SQLite's bytewise order; migration 2 reads JSON with `#>>` instead of `json_extract`. `ON CONFLICT ... DO UPDATE` is shared text, since Postgres has it.
- An `int8` reads back as a number when it is a safe integer (as node:sqlite returns it) and as a bigint otherwise; a `bytea` reads back as a `Uint8Array`. Column aliases are lowercase on Postgres unless quoted.
- The advisory lock's key is `(hashtext('engram.log'), hashtext(current_schema()))`: one lock per log, and two logs in one database (the tests' schemas) do not block each other.
- Opening has its own timeout (`connectTimeoutMs`, 60 s by default), since a worker on a loaded machine starts slowly; statements default to 30 s (`timeoutMs`). After a `DbTimeoutError` the worker is terminated and the `Db` refuses every statement.
- Nested transactions are one helper both backends share (`packages/core/src/db/transaction.ts`); they differ only in the outer begin text.

## Alternatives considered

- Defer Postgres until E8.1 needs a shared log and amend the card to "deferred": lowest risk, but the card would not close and the contract suite would have one backend, so the swap would stay untested.
- Make `Db` asynchronous end to end: touches every function that takes a `Db`, the read snapshot and the write queue, in load-bearing thesis code, before Gate B. Rejected for now; the worker design does not preclude it later.
- PGlite (Postgres in WebAssembly) as the test backend: also asynchronous, a second driver API, and not what compose runs. Not taken; it can back the contract suite later if the service container proves slow.
- Driver: `postgres` (postgres.js, Unlicense, public domain, compatible with Apache-2.0) over `pg` (MIT): one package, no native build, `unsafe(sql, params)` for prepared text. Exact-pinned in `docs/deps.md` when added.

## Consequences

Closes card E1.1. A write from the CLI beside a pi session on one Postgres log is serialised; on one SQLite file it still is not, and ADR 0007 keeps saying so. A hung worker fails a statement after the timeout instead of blocking the process. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/0003-event-log-and-sqlite.md`
- `docs/decisions/0007-write-gate-and-source-isolation.md` (the write queue and its cross-process limit)
- `docs/readings/litreview/2605.30771-eywa.md` (SQLite authoritative, projections rebuildable)
- `docs/tasks/gate-a-e0-e1-e2-plan.md`
