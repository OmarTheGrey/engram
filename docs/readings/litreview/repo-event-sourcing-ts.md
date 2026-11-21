---
id: repo-event-sourcing-ts
title: TypeScript event-sourcing libraries compared (Emmett, Castore, KurrentDB client)
authors: various
venue: open-source tools, 2026
year: 2026
tier: new
topics: [store, event-sourcing, comparison]
engram: [plane]
code: https://github.com/event-driven-io/emmett
sources_read: [https://github.com/event-driven-io/emmett, https://github.com/castore-dev/castore, https://github.com/kurrent-io/KurrentDB-Client-NodeJS, https://github.com/kurrent-io/KurrentDB]
---

## Claim
No TypeScript event-sourcing library fits a log whose every append carries a policy decision and a synchronous projection. What is useful is their vocabulary: streams, expected version, projections, snapshots.

## Method
Compared by repository metadata and package layout. We did not run any of them.

## Key numbers
- Emmett: 567 stars, pushed 2026-11-12, npm 0.42.5, with SQLite and Postgres packages. GitHub and the npm registry report no licence, and the author's intro post says it was deliberately not MIT at the start. Treat as not absorbable until clarified.
- Castore: MIT, 275 stars, last push 2025-10-12.
- KurrentDB Node client: Apache-2.0, 178 stars, pushed 2026-11-19. The KurrentDB server is under the Kurrent License v1 (not OSI), not absorbable.

## What Engram borrows
Optimistic concurrency by expected stream version (a per-item `expected_seq` on append) and snapshot-plus-tail replay.

## What Engram does differently
Our `Db` contract is synchronous (ADR 0024) and appends project in the same transaction. None of these libraries are.

## Risk to our claims
None to claims. The risk is wasted effort adopting a framework against rule 1 and the synchronous contract.

## Open question
Is Emmett's licence status resolved by its author? Ask before reading its code closely.

## Notes
Emmett's licence is unverified.
