---
id: repo-xtdb-bitemporal
title: XTDB v2 and bitemporal query semantics
authors: XTDB contributors
venue: open-source database, 2026
year: 2026
tier: new
topics: [store, bitemporal, temporal, sql]
engram: [plane, H3]
code: https://github.com/xtdb/xtdb
sources_read: [https://github.com/xtdb/xtdb, https://docs.xtdb.com/quickstart/sql-overview.html]
---

## Claim
XTDB v2 makes system time (when recorded) and valid time (when true) first-class in SQL, with non-destructive updates and an explicit ERASE.

## Method
All writes go through one append-only transaction log (`xt.txs`). Queries say `FOR VALID_TIME AS OF`, `FOR SYSTEM_TIME AS OF`, `ALL` or `BETWEEN`, and `SETTING DEFAULT ...` sets a basis for a whole query.

## Key numbers
- Repository: MPL-2.0, 3,101 stars, Clojure, latest release v2.2.0 on 2026-10-21 (gh api).

## What Engram borrows
The query vocabulary only: an `asOf({system, valid})` read over the log, matching ADR 0005 and the `valid_at` of card RV5.

## What Engram does differently
No server. Engram answers as-of queries from its own event log and `itemsAt`, and the policy decision is itself an event, not just data.

## Risk to our claims
Bitemporal replay interacts with the access-time rule of RV5 (no read judged before the log head). System-time as-of must be defined against `seq`, not wall clock.

## Open question
Should system time be addressed by `seq` or by `ts`, given `ts` can run backwards?

## Notes
JVM server under MPL-2.0: ideas only. Embedding in Node was not found in the sources read.
