# 10-eventlog-storage: event log, storage and temporal databases

## Executive summary

Engram's log (ADR 0003, 0024) is already the right shape: dense `seq`, append-only, projection rebuilt by replay, synchronous `Db` over node:sqlite or Postgres. No TypeScript event-sourcing framework is worth absorbing: Emmett has no declared licence, Castore is quiet since 2025-10, and KurrentDB's server is under the non-OSI Kurrent License v1. The wins are around the log, not in it. (1) Export it to Parquet for analysis (DuckDB for Python research, pure-JS hyparquet-writer for the product), with erasure honoured. (2) Back it up with Litestream as a documented sidecar and prove restore-then-replay equality. (3) Add an explicit bitemporal `asOf({seq|system, valid})` API using XTDB's vocabulary, built on `itemsAt` and RV5's `valid_at`. (4) Add snapshots and a verifiable log head (hash chain) so replay and audit stay cheap as the log grows. Node 24.14 here has `DatabaseSync.createSession`, `applyChangeset` and a module-level `backup`, verified by running them, which gives an in-process route to CDC and backup with no new dependency.

## Landscape

Stars and dates from `gh api` on 2026-11-21 unless noted.

| name | URL | licence | stars / last activity | language | gives us | absorb mode |
|---|---|---|---|---|---|---|
| Litestream | github.com/benbjohnson/litestream | Apache-2.0 | 14,648 / v0.5.18 2026-11-03 | Go | WAL streaming, LTX, PITR, VFS time travel | operator tool, ideas |
| DuckDB | github.com/duckdb/duckdb | MIT | 43,216 / v2.0.1 2026-11-20 | C++ | SQLite scanner, Parquet COPY | depend (research, optional) |
| duckdb-node-neo | github.com/duckdb/duckdb-node-neo | MIT | 200 / 2026-11-20 | TS | `@duckdb/node-api` 2.0.1-r.1 | depend (optional) |
| hyparquet, hyparquet-writer | github.com/hyparam/hyparquet-writer | MIT | 68 (writer) / 2026-11-08; hyparquet 978 | JS | pure-JS Parquet write (npm 0.18.0) | depend |
| kylebarron/parquet-wasm | github.com/kylebarron/parquet-wasm | Apache-2.0 | 675 / 2026-11-16 | Rust/WASM | Arrow-to-Parquet in WASM | alternative |
| apache/arrow-js | github.com/apache/arrow-js | Apache-2.0 | 112 / 2026-11-17 | TS | Arrow tables | optional |
| XTDB v2 | github.com/xtdb/xtdb | MPL-2.0 | 3,101 / v2.2.0 2026-10-21 | Clojure | bitemporal SQL vocabulary | ideas only |
| Turso (Rust SQLite rewrite) | github.com/tursodatabase/turso | MIT | 25,307 / 2026-11-21 | Rust | embedded sync, CDC | ideas; not verified for Node use here |
| libsql | github.com/tursodatabase/libsql | MIT | 17,349 / 2026-11-20 | C | embedded replicas | ideas |
| LiteFS | github.com/superfly/litefs | Apache-2.0 | 4,921 / 2026-10-30 | Go | FUSE replication | ideas only (FUSE, no Windows) |
| Debezium | github.com/debezium/debezium | Apache-2.0 | 13,366 / 2026-11-20 | Java | CDC patterns | ideas only |
| PGlite | github.com/electric-sql/pglite | Apache-2.0 | 16,353 / 2026-11-20 | TS/WASM | in-process Postgres | alternative test backend |
| Emmett | github.com/event-driven-io/emmett | none declared (GitHub, npm) | 567 / 2026-11-12 | TS | expected-version, projections | ideas only; licence unverified |
| Castore | github.com/castore-dev/castore | MIT | 275 / 2025-10-12 | TS | event-store vocabulary | ideas only |
| KurrentDB client | github.com/kurrent-io/KurrentDB-Client-NodeJS | Apache-2.0 (server: Kurrent License v1) | 178 / 2026-11-19 | JS | gRPC client | not useful |

Datomic is closed, ideas only (not fetched).

## PR plans

### AB-LOG-1: Parquet export of the log
- goal: `engram export --format parquet --out <dir>` writes `events` (and explanations, decisions flattened) as day-partitioned Parquet with the schema version in file metadata; a Python script reads it back with DuckDB.
- absorbs: hyparquet-writer (depend); DuckDB only in `research/` via Python.
- files: `packages/core/src/export/rows.ts` (pure row flattening, no I/O; the log has `events`, `items` and `explanations` tables), `packages/cli/src/export.ts`, `research/scripts/log_duckdb.py`, `docs/deps.md`, `docs/log/`.
- effort: M. depends on: none.
- value: product, analytics for the inspector and audit handovers; thesis, H3 and H4 scripts query columns instead of JSON bodies, reproducibly.
- risks: erased items must not survive in an export (offboarding already redacts earlier events in place, ADR 0010, so export the redacted bodies and test it); an export of the whole log bypasses the read matrix, so `engram export` takes `--as <actor>` and goes through `visibleEvents` (as `POST /events` does), with a whole-log export only for the log's owner, flagged as such (verifier fix); new dependency pinned two weeks old; hyparquet-writer is small (68 stars), keep a fallback to DuckDB `COPY`.
- acceptance: `make test-one T=packages/cli/test/export.test.ts` (round trip: export, read back, row count and seq order equal the log; an erased item's body is absent).

### AB-LOG-2: Continuous backup and verified restore
- goal: document and test Litestream as the SQLite log's backup (config template, `engram doctor` check that a replica is configured and fresh), plus an in-process `engram log backup` using node:sqlite's `backup` for users with no sidecar.
- absorbs: Litestream (operator tool, not vendored; Go binary).
- files: `packages/cli/src/log-backup.ts`, `packages/cli/src/doctor.ts`, `docs/operations/backup.md` (new folder). The restore test builds its log in a temp folder; `fixtures/` is regenerated only by `make fixtures`, so no fixture is committed (verifier fix).
- effort: S. depends on: none.
- value: product, data safety for the per-user log; thesis, reproducibility of dogfood counts.
- risks: AGENTS.md rule 12, dogfood content never leaves the member's machine: the documented Litestream config must use a local-file replica or storage the member owns, never a shared bucket, and doctor warns on an S3/GCS replica URL (verifier fix); Litestream adds `_litestream_lock` to the log (replay equality, not byte equality, is the test); beta status; Go binary absent on CI so the CI test uses node:sqlite `backup`.
- acceptance: `make test-one T=packages/cli/test/log-backup.test.ts` (backup, restore into a new file, `rebuild()` equals projection, invariants pass).

### AB-LOG-3: Bitemporal as-of API
- goal: `Plane.asOf({ seq? , system_at?, valid_at? })` returns items and explains reads as the log stood, using seq as the system-time axis; CLI `engram read --as-of-seq N --valid-at T`; server route.
- absorbs: XTDB's `SYSTEM_TIME` and `VALID_TIME` vocabulary (ideas).
- files: `packages/core/src/replay.ts` (extend `itemsAt`), `packages/core/src/plane/read.ts`, `packages/cli`, `packages/server` route table (then `make api`), ADR 0037.
- effort: M. depends on: RV5 (valid_at, access clock).
- value: product, "what did the agent know at the time of this action" audit; thesis, H3 staleness measured as of any event.
- risks: ts can run backwards (ADR 0005 records it), so system time must be seq-addressed; `itemsAt` already exists in `packages/core/src/replay.ts`, so the new part is the policy-filtered, explained read; erased items cannot be replayed; interacts with ADR 0005's access-time rule.
- acceptance: `make test-invariants` plus a property test over 500 seeded sequences that `asOf(seq=n)` returns the item ids each earlier read event recorded (`item_ids`) when its policy and `valid_at` are the same. Comparing with `itemsAt(db, n)` alone is circular, since `asOf` is built on it (verifier fix). Dependency RV5 is merged (cd1b635).

### AB-LOG-4: Snapshots and log compaction (VERIFIER: DROP, see Verification)
- goal: periodic projection snapshot rows (`snapshots(seq, body_hash, body)`) so replay and `itemsAt` start from the nearest snapshot; compaction means dropping snapshots and exported-and-archived old segments, never rewriting events.
- absorbs: snapshot-plus-tail idea (Emmett, Castore vocabulary); Litestream's level compaction as the model.
- files: `packages/core/src/db/migrate.ts` (a migration, so its own schema PR per rule 5), `packages/core/src/replay.ts`, `packages/core/src/events.ts`.
- effort: L. depends on: AB-LOG-3.
- value: product, bounded start-up time at millions of events; thesis, `make test-scale` stays fast.
- risks: a snapshot is a second copy of item bodies and must be dropped on erasure; schema change PR rule; the invariant that rebuild equals incremental must also hold from a snapshot.
- acceptance: `make test-one T=packages/core/test/snapshot.test.ts` (rebuild from snapshot plus tail equals full rebuild, after an erasure too).

### AB-LOG-5: Change capture feed (CDC) from the log (VERIFIER: KEEP-WITH-FIX, reduce to a CLI tail)
- verifier note: the server already has `POST /events` with an `after` seq, filtered by `visibleEvents` and the read matrix (`packages/server/src/routes.ts`), so the reader, resumability and redaction exist. What remains is an `engram tail` CLI over that route (S), optionally SSE; the webhook sink is dropped (egress, and rule 12).
- goal: `Plane.tail({ after_seq })` and an `engram tail --json` stream (NDJSON, resumable by seq) plus an outbox-style webhook sink, so SIEM and downstream systems consume decisions without polling SQL.
- absorbs: Debezium's resumable-offset and at-least-once pattern (ideas); node:sqlite session API is not needed because events already have dense seq.
- files: `packages/core/src/events.ts` (a `eventsAfter` reader), `packages/cli/src/tail.ts`, `packages/server` (SSE route).
- effort: M. depends on: none.
- value: product, integrations and live inspector; thesis, minor.
- risks: a feed leaks events to readers who cannot read the scope (apply the read matrix, reasons must not name items); server is loopback only.
- acceptance: `make test-one T=packages/cli/test/tail.test.ts` (resume after a crash gives no gap or duplicate; a non-member sees redacted reasons).

### AB-LOG-6: Hash-chained log head
- goal: each event stores `prev_hash`; `engram log verify` checks the chain and prints the head hash, which backups and exports record.
- absorbs: transparency-log idea (see `repo-tlog-checkpoints` from another agent), not a library.
- files: `packages/core/src/schema.ts` (schema PR alone), migration, `packages/core/src/events.ts`, `packages/cli`.
- effort: L. depends on: none; coordinate with the 04-security agent.
- value: product, tamper evidence for "every decision is logged"; thesis, supports the audit claim.
- risks: offboarding redacts earlier events in place (ADR 0010, `offboard.ts`), so the hash must cover a salted commitment to the redactable fields, with the salt dropped on erasure, or erasure breaks the chain; needs an ADR; overlaps `repo-tlog-checkpoints` from the security agent, so one PR for both, not two (verifier fix: effort L, and keep the hash in a log column rather than `schema.ts`, which avoids a MemoryEvent schema bump).
- acceptance: `make test-invariants` plus a verify test that detects a flipped byte.

### AB-LOG-7: Concurrent-writer story for SQLite (VERIFIER: DROP, see Verification)
- goal: measure and document writer contention on one SQLite file across processes (ADR 0007 notes SQLite lacks cross-process ordering), using `BEGIN IMMEDIATE` and WAL, and add a stress test.
- absorbs: none; Litestream's lock notes inform it.
- files: `packages/core/src/db/sqlite.ts`, `packages/core/test/db/`.
- effort: S. depends on: none.
- value: product, correctness under CLI plus pi plus MCP; thesis, minor.
- risks: touches load-bearing core, keep the contract suite unchanged.
- acceptance: `make test-one T=packages/core/test/db/multiprocess.test.ts`.

## Recommended order

1. **AB-LOG-1 (Parquet export)**: best ratio of value to risk, one pinned MIT dependency, and it feeds the thesis analyses and the inspector.
2. **AB-LOG-3 (bitemporal as-of)**: the most distinctive feature (replay of what the agent knew), builds on RV5, no new dependency.
3. **AB-LOG-2 (backup and verified restore)**: small, protects the dogfood data, and the restore-replay test is a strong evidence artifact.

## Unverified

- Emmett's licence (none declared on GitHub or npm; author's early statement only).
- Whether DuckDB's SQLite scanner supports a read-only attach.
- Turso's Node bindings and sync behaviour in 2026; libSQL embedded replica status.
- XTDB embeddability in Node; Datomic details (closed, not read).
- Litestream's "dozen files" restore claim (blog statement).

## Verification (2026-11-21)

Checked with `gh api`, `npm view` and the repository:
- Every repo's licence, stars, push date and release in the Landscape table match `gh api` (Litestream 14,648 and v0.5.18 on 2026-11-03; DuckDB 43,216 and v2.0.1; XTDB MPL-2.0 3,101 and v2.2.0; Emmett 567, no licence reported and no LICENSE file at the root; Castore MIT, last push 2025-10-12). `hyparquet-writer` 0.18.0 MIT, published 2026-10-29, so older than two weeks. `@duckdb/node-api` 2.0.1-r.1 MIT. No number needed correcting. The KurrentDB server licence could not be fetched (network error) and stays unverified.
- Node 24.14.0 here has module-level `backup`, `DatabaseSync.prototype.createSession` and `applyChangeset` (run, with the experimental warning).
- No papers are cited. The four litreview notes (`repo-duckdb-analytics`, `repo-litestream`, `repo-xtdb-bitemporal`, `repo-event-sourcing-ts`) have ids equal to their file names, code URLs that resolve to the named repos and no em dash. `repo-tlog-checkpoints` belongs to another agent.

Corrected:
- AB-LOG-1: export must go through the read matrix (`--as`), as `POST /events` does.
- AB-LOG-2: Litestream to a shared bucket would break AGENTS.md rule 12; no committed fixture (fixtures are `make fixtures` only).
- AB-LOG-3: the acceptance test was circular; compared with recorded read events instead. RV5 is merged.
- AB-LOG-6: effort L, hash kept out of `schema.ts`, merge with the security agent's tlog plan.

Refuted:
- "ADR 0007 notes SQLite lacks cross-process ordering" (AB-LOG-7): ADR 0007's E2.6 amendment supersedes it; writers on different handles are ordered by `BEGIN IMMEDIATE` and the commit protocol, with cross-handle tests on SQLite and Postgres (`packages/core/test/unit/plane/cross-handle*.test.ts`, `packages/core/test/db/postgres.test.ts`). ADR 0024's closing line is stale. AB-LOG-7 is dropped.
- AB-LOG-5's "no feed exists": `POST /events` with `after` already exists.
- AB-LOG-4's need: the `items` table is already the incremental projection, so snapshots help only `itemsAt` and as-of audit, with no measured start-up problem.
