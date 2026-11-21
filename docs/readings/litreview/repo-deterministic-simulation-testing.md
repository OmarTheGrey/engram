---
id: repo-deterministic-simulation-testing
title: Deterministic simulation testing (TigerBeetle VOPR, FoundationDB, Antithesis)
authors: TigerBeetle, FoundationDB and Antithesis teams
venue: engineering practice
year: 2026
tier: new
topics: [methods, testing, simulation, concurrency]
engram: [plane, H1]
code: https://github.com/tigerbeetle/tigerbeetle (Apache-2.0, 17419 stars, pushed 2026-11-11, Zig; gh api verified); https://github.com/antithesishq/antithesis-sdk-typescript (MIT, 9 stars; the Antithesis platform itself is commercial)
sources_read: [gh api repository metadata only; the practice itself is described from background knowledge and was not re-read]
---

## Claim
Run the system under a single-threaded seeded scheduler with an injected clock, I/O faults and message reordering, so any failure replays exactly from a seed.

## Method
TigerBeetle's simulator (VOPR) runs whole clusters in one process with fault injection, and FoundationDB built its engine around this from the start. Not re-read for this note.

## Key numbers
- None stated in the sources read.

## What Engram borrows
Engram already injects clock and seeds (rule 15). Missing is a simulated store and log with injected faults (store write throws, crash between store write and event append, lock contention) and a seeded scheduler over N Plane handles. That is AB-FRM-4, using fast-check's scheduler, with no new dependency.

## What Engram does differently
Node is single-threaded with real SQLite and Postgres I/O, so interleavings come from await points, which a scheduler can enumerate. Engram cannot simulate the kernel as TigerBeetle does.

## Risk to our claims
Simulated faults reach only the fault points we write; real Postgres lock behaviour is unsimulated.

## Open question
Which crash points in `commit.ts` (store written, event not appended) already have fakes?

## Notes
Antithesis is a hosted platform and not open source; its Docker requirements were not checked. Ideas only.
