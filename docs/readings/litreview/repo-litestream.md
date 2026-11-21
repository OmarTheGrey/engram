---
id: repo-litestream
title: Litestream (SQLite replication to object storage, v0.5 LTX, VFS)
authors: Ben Johnson et al.
venue: open-source tool, Fly.io blog posts 2025
year: 2025
tier: new
topics: [store, replication, backup, sqlite]
engram: [plane, govern]
code: https://github.com/benbjohnson/litestream
sources_read: [https://github.com/benbjohnson/litestream, https://fly.io/blog/litestream-v050-is-here/, https://litestream.io/how-it-works/vfs/]
---

## Claim
Litestream streams a SQLite database's WAL changes to a file or object-storage replica, giving continuous backup and point-in-time restore without touching application code.

## Method
A sidecar process tails the WAL and ships changes. Since v0.5 the replica holds LTX files, a page-indexed, individually compressed format with monotonically increasing transaction ids, compacted in levels (L0 raw, L1 and above merged). A VFS extension serves read-only replicas and `PRAGMA litestream_time` time travel straight from the replica. It creates an internal `_litestream_lock` table in the source database.

## Key numbers
- Repository: Apache-2.0, 14,648 stars, latest release v0.5.18 on 2026-11-03 (gh api, 2026-11-21); README badge says beta.
- The Fly.io post says a restore needs "a dozen or so files on average" (blog claim, not measured by us).

## What Engram borrows
A sidecar backup story for the per-user log (ADR 0003 default), documented and checked by a restore-then-replay test. The transaction id idea maps onto our dense `seq`.

## What Engram does differently
We never embed it. The log's own `seq` and a content hash are the integrity record. Litestream is an operator tool beside the process, and its extra table must not alter replay.

## Risk to our claims
The log file gains `_litestream_lock`, so byte identity of a backed-up log is lost. Replay equality, not bytes, must be the check.

## Open question
Does a restored log replay to the same projection under the seven invariants, including after an erasure event?

## Notes
Go binary, so a documented external tool, not an npm dependency. Restore from pre-0.5 WAL segments is unsupported per the blog.
