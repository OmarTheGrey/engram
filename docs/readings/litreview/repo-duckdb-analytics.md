---
id: repo-duckdb-analytics
title: DuckDB, its SQLite scanner and Node API, and Parquet writers
authors: DuckDB contributors
venue: open-source tools, 2026
year: 2026
tier: new
topics: [store, analytics, parquet, export]
engram: [plane, H3, H4]
code: https://github.com/duckdb/duckdb
sources_read: [https://github.com/duckdb/duckdb, https://github.com/duckdb/duckdb-node-neo, https://duckdb.org/docs/current/core_extensions/sqlite, https://github.com/hyparam/hyparquet-writer]
---

## Claim
DuckDB can read a SQLite file in place and write Parquet with one `COPY`, so the event log can be analysed in columns without a second store.

## Method
The SQLite extension attaches a file (`ATTACH 'f.db' AS f (TYPE sqlite)`) or scans a table (`sqlite_scan`), and `COPY ... TO 'x.parquet'` writes Parquet. `@duckdb/node-api` (duckdb-node-neo) is the maintained Node binding. `hyparquet` and `hyparquet-writer` are a pure JavaScript Parquet reader and writer.

## Key numbers
- duckdb: MIT, 43,216 stars, v2.0.1 released 2026-11-20 (gh api).
- duckdb-node-neo: MIT, 200 stars, npm `@duckdb/node-api` 2.0.1-r.1, pushed 2026-11-20.
- hyparquet-writer: MIT, 68 stars, npm 0.18.0.
- The docs say several readers but one writer on an attached SQLite file. A read-only attach option was not confirmed in what we read.

## What Engram borrows
Export of `events`, `explanations` and decisions as Parquet partitioned by day, for the H1 to H4 analysis scripts and the inspector's aggregate views.

## What Engram does differently
Export is a derived artifact, never a source of truth. Erasure events must propagate: a re-export drops erased bodies.

## Risk to our claims
A Parquet copy of an erased item is a second copy. The export must honour the erasure rule or it breaks the person-scope erasure claim.

## Open question
Is `hyparquet-writer` enough, or is the native DuckDB binary acceptable in CI on Windows?

## Notes
The Node API ships native binaries per platform. The pure JavaScript route avoids them. Python research code can use `duckdb` directly with no product dependency.
