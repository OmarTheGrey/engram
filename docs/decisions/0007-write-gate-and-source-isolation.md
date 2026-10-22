# ADR 0007: Write gate rules and source isolation

Status: accepted, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

MPBench (aggressive write policies are easier to poison; weak-signal attacks evade detectors); MemSecBench (adoption is the bottleneck, so blocking at write is cheaper than catching at read); Mem0's ADD, UPDATE, DELETE, NOOP as the interception point.

## Decision

(a) at the gate; model-based checks are lints that run after the write and can retire. The gate is deterministic so the H1 condition "enforcement" has no model in it. Every MPBench attack class maps to a rule or a lint in `fixtures/faults/`; classes with no deterministic defence are listed in the thesis as such.

## Alternatives considered

(a) Deterministic rules only: source kind, scope, class, provenance presence, hash, size, and a per-scope budget. (b) Add a model-based classifier at write time.

## Consequences

Unblocks E2.2, L2, the MPBench arm. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2606.04329-mpbench.md`
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
