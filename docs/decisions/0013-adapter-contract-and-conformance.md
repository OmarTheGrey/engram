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

Amendments made in the review fix pass, 2026-10-25 (PR #4, findings R4-1 to R4-16; pending the lead's review like the rest of this ADR):

- Fidelity: `read`, `list`, `search` and `history` return exactly the item written, every field deep-equal (grants, validity window, ttl, lineage, optional provenance fields, JSON content, content of any length, any Unicode including CRLF and a lone surrogate), with `store_ref` set to the ref the write returned. The suite compares whole items on every hit, and a committed meta-test (`packages/adapters/test/conformance/meta.test.ts`) requires each of twelve deliberately broken adapters to fail at least one case.
- Refs (orchestrator decision D1): several versions may live under one ref, which is the same item id rewritten (`history`); two distinct item ids get two refs, because both must stay readable. A rewrite that changes only `status` is stored.
- `list(scope)` matches the scope exactly; a prefix of a scope name, or a sibling such as `team:platform-x`, never matches.
- A foreign ref is refused by a rejected promise, never a synchronous throw, for `read`, `delete` and `history`; a refused delete deletes nothing.
- Concurrent writes of one item id leave one item under one ref; an adapter serialises its own writes when the store cannot (Mem0 does).
- `native_search` means the store searches by itself (an index or embeddings, the sense ADR 0018 relies on). An adapter may offer `search` without the flag: the files adapter scans the folder and now declares `native_search: false`, matching "files (nothing)" above.
- Files adapter: only regular files directly in the root are read or listed (symlinks, junctions and directories are skipped and refused); a malformed file is skipped by `list` and `search` and reported by `diagnostics()`, while `read` of it still throws; item ids must be lowercase and a name that differs only in case is refused; every write and delete holds `.engram.lock` in the root; Engram's index lines use " - ", and Claude Code's own lines are left as written.
- Mem0 adapter: `dbPath` is ":memory:" or a file ending in `.db`, and a file store writes `<name>_entities.db` beside it; telemetry is off whatever the import order; Mem0's model slot is replaced by one that refuses every call.

Amendments made in review round 2, 2026-10-28 (PR #4, verifier report V4; pending the lead's review like the rest of this ADR):

- Fidelity also covers confidence at 0 and at 1, a lineage of several entries in the order written (neither sorted nor reversed), content with leading and trailing whitespace, a `role:` scope and an episodic item; the corpus holds each.
- `search` returns matching items whatever their status: candidate and retired items are found like active ones, because status is the plane's read filter, not the store's.
- The meta-test pins each broken adapter (now nineteen) to the cases it must fail, by name.
- Files adapter: a hard link (a file with more than one name) is treated like a symlink: skipped and reported by list and search, refused by read, write and delete, and MEMORY.md is refused when it is one. The earlier claim that nothing outside the root is followed held for symlinks and junctions only.
- Files adapter: a write or delete is all or nothing. MEMORY.md is checked before the item file changes, and if the index update fails anyway, the item file is removed or its previous bytes restored.
- Files adapter: the lock file records the holder's pid, host, a per-instance token and the wall-clock time (the adapter has no injected clock; the time is a fact of store I/O, not a policy input). A waiter breaks a lock whose pid is not alive on this machine, or that is older than 60 s; otherwise it waits up to `lockWaitMs` (default 10 s) and refuses, naming the holder. `lockSeams` (a clock and two hooks, defaulting to the wall clock and no-ops) exists only so tests can stage the lock's races.
- Mem0 adapter: the placeholder model in Mem0's config fails with its own error, distinct from the refusal of the replaced model slot, so a test shows the replacement is in place.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks A1 to A4. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
