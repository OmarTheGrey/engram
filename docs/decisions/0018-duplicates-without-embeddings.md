# ADR 0018: Duplicate and near-duplicate detection without embeddings by default

Status: accepted, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

The duplicate lint must be deterministic to count in H3's deterministic tier; pi-ai does not appear to expose an embeddings API (unverified); stores differ in native search.

## Decision

Exact duplicate by normalised content hash; near-duplicate by MinHash over shingles with a fixed threshold; embedding-based similarity only through a store's native search when `native_search` is set, reported as a model-based lint. No embedding provider is a dependency of core.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks L1. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
