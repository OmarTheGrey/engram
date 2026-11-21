---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: evaluation
pillar: plane
hypothesis: H2
evidence:
  - packages/core/bench/workload.ts
supersedes: none
---

**What.** The bare node:sqlite baseline is a file database with the plane log's own pragmas (WAL, busy timeout), in the same temporary folder: one INSERT per write, and per read one SELECT of the rows in the reader's scopes holding the word, over a table of N rows with an index on scope.

**Why.** The card asks for a bare node:sqlite baseline without fixing it. An in-memory baseline would leave out the fsync each WAL commit pays, which the plane's log also pays, and the ratio would then mix the plane's cost with the storage mode's.

**Result.** The ratio of a plane cell to its baseline is the plane's cost over a single-statement store on the same disk, not over a store that does nothing.

**Consequence.** A reader who wants the in-memory ratio reruns the suite with another baseline.
