---
id: repo-sqlite-vec
title: sqlite-vec, a vector search SQLite extension
authors: Alex Garcia
venue: GitHub repository
year: 2026
tier: new
topics: [retrieval, store, vector, embedded]
engram: [plane]
code: https://github.com/asg017/sqlite-vec
sources_read: [gh api repos/asg017/sqlite-vec, npm view sqlite-vec]
---

## Claim
A small C extension giving SQLite exact (brute-force) nearest-neighbour search over float, int8 and binary vectors, loadable from Node.

## Method
Not run by us. Metadata only: Apache-2.0 on GitHub (verified), 8,273 stars, last push 2026-05-18, C. The npm package sqlite-vec 0.1.9 declares "MIT OR Apache". Pre-1.0, six months since the last push. That search is brute force comes from search results, not the repo.

## Key numbers
- Stars 8,273; last push 2026-05-18; npm 0.1.9 (gh api and npm view, 2026-11-21).

## What Engram borrows
A vector table beside the SQLite log with no server: an adapter-side vector index. Lands in AB-RET-3.

## What Engram does differently
Exact search only, and only over items the read filter admitted; the index is never searched ahead of the filter (ADR 0009 N1).

## Risk to our claims
Loading a native extension may not work with node:sqlite on every platform; untested on Windows. Pre-1.0.

## Open question
Does node:sqlite on Node 24 allow loading extensions, or must the adapter use better-sqlite3 (already a dependency)?

## Notes
Brute force suffices for per-scope sets of thousands of items. A pure TypeScript flat index is the fallback and needs no native code.
