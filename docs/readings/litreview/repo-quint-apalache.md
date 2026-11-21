---
id: repo-quint-apalache
title: Quint, Apalache and TLC (TLA+ family) for protocol model checking
authors: Informal Systems (Quint, Apalache); Leslie Lamport and community (TLA+, TLC)
venue: open-source tools
year: 2026
tier: new
topics: [methods, formal, model-checking, testing]
engram: [plane, govern, twin, H4]
code: https://github.com/quint-co/quint (Apache-2.0, 2145 stars, pushed 2026-11-20, v0.33.1), https://github.com/informalsystems/apalache (Apache-2.0, 629 stars, pushed 2026-11-18, v0.63.0), https://github.com/tlaplus/tlaplus (MIT, 3267 stars, pushed 2026-11-19); all verified with gh api
sources_read: [https://github.com/quint-co/quint, https://github.com/informalsystems/apalache, https://github.com/tlaplus/tlaplus, search results on quint-connect]
---

## Claim
Quint gives TLA+'s logic a TypeScript-flavoured syntax with a simulator and `quint verify` (Apalache, symbolic, SMT), so a protocol such as Engram's commit and erasure path can be specified, model checked, and then replayed as traces against the implementation.

## Method
Quint specs are state machines (init, step actions with non-determinism, invariant and temporal definitions). `quint run` simulates randomly, `quint verify` checks invariants with Apalache (bounded, symbolic, needs a JVM), and TLC (explicit state, needs Java) is the classic alternative through TLA+. Quint can emit ITF traces. quint-connect (Rust, official, quint-co/quint-connect, Apache-2.0, 110 stars, pushed 2026-05-25) replays traces through a driver and compares state. A TypeScript port exists (dearlordylord/quint-connect-ts, Apache-2.0, 15 stars, pushed 2026-11-17; npm `@firfi/quint-connect`), third party and small.

## Key numbers
- Versions and stars above are from gh api on 2026-11-21. No performance numbers were read.

## What Engram borrows
A spec `specs/commit.qnt` of `commit.ts` (decide at head N, append only if the item and erasure marker are unchanged, offboard begin, sweep, report) with safety properties: no write after an erasure begin lands in the erased scope, an erased id is never re-admitted, store and log agree after every step. Traces then drive the real Plane through a driver (AB-FRM-1, AB-FRM-2). The litreview's Origin-Bound Authority note (2606.24322) cites a TLC model whose repo could seed a provenance spec.

## What Engram does differently
Model checking proves the design in a bounded instance (a few writers, items, handles); the TypeScript is not verified, only trace-tested against the spec.

## Risk to our claims
Bounded checking can be read as a proof. State it as "no counterexample up to N writers, M items". Apalache needs a JVM, a new toolchain; keep it a `make verify-spec` target outside `make test`.

## Open question
Is the TypeScript quint-connect port stable enough to depend on, or is a 100-line in-repo ITF trace reader (ITF is JSON) better?

## Notes
Alloy 6 (AlloyTools/org.alloytools.alloy, 890 stars, last push 2026-06-11) reports licence NOASSERTION in gh api, so it is ideas only. P (p-org/P, MIT, 3741 stars) is C#, a heavier fit with no TypeScript path.
