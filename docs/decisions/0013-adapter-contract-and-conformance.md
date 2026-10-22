# ADR 0013: Adapter contract with capability flags; conformance suite on a fake first

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

The stores differ in what they do natively: Mem0 (extract and update with ADD, UPDATE, DELETE, NOOP; history endpoint; graph variant), Letta (memory blocks plus archival; TypeScript client), Zep (native bi-temporal), files (nothing). The plane must respect a native feature rather than duplicate it.

## Decision

`Adapter` with `read`, `write`, `delete`, `list`, `search?`, `history?` and `capabilities: {native_validity, native_history, native_search, native_graph}`. `store_ref` is opaque. A complete in-memory fake passes the full conformance suite; real stores run the same suite in CI service containers. Mem0 through its TypeScript OSS package, Letta through `@letta-ai/letta-client`, files through the filesystem.

Amendments made when deciding:

- Implemented in S0.11: the contract is asynchronous; a write is idempotent per item id; a ref from another adapter is refused; the conformance suite is the exported function `conformance(name, factory)`; a capability claiming native search or history requires the method.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks A1 to A4. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
