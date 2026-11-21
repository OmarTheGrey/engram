---
id: repo-sqlite-wal-tuning
title: SQLite WAL mode, synchronous levels and checkpoint tuning
authors: SQLite project
venue: sqlite.org documentation (wal.html) and forum
year: 2026
tier: new
topics: [sqlite, performance, durability, store]
engram: [plane, govern]
code: https://sqlite.org
sources_read: [search excerpts of https://www.sqlite.org/wal.html, https://nodejs.org/docs/latest-v24.x/api/sqlite.html]
---

## Claim
In WAL mode, `synchronous=NORMAL` skips the sync at each commit and only syncs at checkpoints, which is much faster, but a power loss can roll back recent commits without corrupting the file. For an audit log that is a durability trade the lead must choose, not a default tweak.

## Method
Documentation and forum excerpts: WAL checkpoints automatically at 1000 pages by default; raising `wal_autocheckpoint` reduces checkpoint frequency; `journal_size_limit` bounds the WAL file after checkpoint. No authoritative guidance on `mmap_size` was found; it should be benchmarked on our data. The Node `DatabaseSync` constructor takes `timeout` (busy timeout, from v24.0.0), `readBigInts` and `returnArrays`; statements have `iterate` and `setReturnArrays`; the page mentions `createTagStore()` caching prepared statements and a `sqlite.db.query` diagnostics_channel event, which could count statements per Plane call. Caveat checked 2026-11-21: the event is in the current Node 24 docs, but it fired zero events on Node 24.14.0, so a wrapper around `Db.prepare` is the safer counter. WAL is not mentioned on the Node page.

## Key numbers
- Autocheckpoint default 1000 pages (sqlite.org WAL page excerpt).
- No Engram-specific numbers: nothing measured yet. Current code (packages/core/src/db/sqlite.ts) sets WAL and a 5 s busy timeout and no `synchronous`, cache or mmap pragma; 38 `.prepare(` call sites in packages/core/src are prepared again on each call (grep count, 2026-11-21).

## What Engram borrows
A tuning profile with named levels (`durable` default, `balanced` with NORMAL, `bulk` for the runner's replay logs), a statement cache in `openSqlite`, and a statement counter via diagnostics_channel for the deterministic budget.

## What Engram does differently
The log is the source of truth and every decision must be logged (AGENTS.md rule 3). Default stays FULL; NORMAL is opt-in and shown in `engram doctor`.

## Risk to our claims
If NORMAL were the default, a crash could lose a logged denial, which weakens the audit claim. Keep FULL for the product and allow relaxed settings only for benchmark and replay logs.

## Open question
What is the p99 gap between FULL and NORMAL on a Windows laptop SSD for one write call?

## Notes
A Mozilla wiki excerpt pairs a small autocheckpoint with a journal limit of three times its size.
