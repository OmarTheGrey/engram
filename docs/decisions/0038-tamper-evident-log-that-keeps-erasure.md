# ADR 0038: A tamper-evident event log that keeps erasure possible: a side-table hash chain over a content-free skeleton, with signed checkpoints

Status: proposed, 2026-11-21
Deciders: drafted by the absorb plan (`docs/tasks/absorb-plan.md`, card E1.6); for the lead's acceptance (`docs/tasks/lead-decisions.md`, item 49)
Supersedes: nothing. It would amend ADR 0003 (the event log is the source of truth) with a way to detect that the log was changed.

## Context

- **The log is trusted, and nothing protects it.** Every guarantee Engram gives is read off the event log: replay, explanation, the invariants, the dogfood report. The log is append-only by convention. A row edited in SQLite or Postgres is not detected by anything.
- **A plain hash chain breaks on erasure.** Offboarding (card E9.7, ADR 0010's amendments) redacts the content, the provenance reference and the evidence hash an erased item carries in every earlier event. A chain that hashes event bodies would stop verifying at the first erasure. Immutability and the right to erasure pull in opposite directions.
- **What exists to absorb.** The sweep found working designs under permitted licences: a hash chain with a genesis and a read-index cross-check (huqan, Apache-2.0), an ordered verifier with a tamper test matrix (world-model-mcp, MIT), Ed25519 signed head checkpoints (octopus-blackboard, Apache-2.0), and the tree and checkpoint formats of RFC 6962 and C2SP's tlog-checkpoint.
- **Constraints.** No change to the event body schema (rule 5 would make it a schema PR, and committed results hash event files). Core does no key I/O. Both Db backends.

## Decision (proposed)

1. **A side table, not a new event field.** A table created in `packages/core/src/db/migrate.ts` holds, per event sequence number, the chain hash. `schema.ts` and the event bodies do not change, so every committed result and fixture stays byte-identical.
2. **The chain hashes a skeleton.** The hashed record is the event's sequence number, type, time, actor, scope, item id, policy id, rule and decision: no content. Each field that offboarding may redact is represented by a salted commitment (a hash of the field with a per-event random salt kept in the side table).
3. **Erasure deletes the salt.** When offboarding redacts an event, it deletes that event's salts. The commitments stay, the chain still verifies, and without the salt a commitment reveals nothing about a low-entropy value. The verifier reports such a link as verified and erased.
4. **One canonical form.** A single function serialises the skeleton for the writer and the verifier: UTC timestamps at fixed precision, integers only, keys in a fixed order, RFC 6962's leaf and node prefixes for domain separation.
5. **Anchors.** Each log has a genesis record. A meta row holds the head hash and the event count, so truncating the tail is detected.
6. **Where the chain starts.** After the migrations that rewrote bodies in place, with a backfill checkpoint that records the sequence number it starts at. Events before it are stated as unchained.
7. **Signed checkpoints.** A checkpoint is the head hash, the count and a time, signed by a function injected at the boundary. Core holds no key. The CLI signs with an Ed25519 key the operator holds, and an unsigned checkpoint verifies as UNSIGNED, a verdict of its own.
8. **A new invariant.** In the always-on file: over random operations including an offboarding, an injected edit, deletion, reorder or tail truncation is detected, on SQLite and on Postgres.
9. **Independent of key destruction.** Erasure by destroying a per-person key (the research's plans R-083 to R-089) is a separate later decision and builds on this chain.

## Alternatives considered

- **Hash the full event body.** Simple, and it makes erasure impossible or makes every erasure look like tampering.
- **A redaction record in the chain** (a digest-only chain where a redaction appends a record saying so). Workable, and it leaves the erased content's digest in place, which for a short value is guessable. Salted commitments close that.
- **An external transparency log or witness.** The strongest evidence, and it needs a service and a network. It can be added on top of signed checkpoints later.
- **Do nothing and state the limit.** Honest, and it leaves "every decision is logged" resting on an editable table.

## Consequences

- Card E1.6 implements this; nothing is built before the lead accepts it.
- A write costs one more hash and one more row, inside the transaction card E2.6 already serialises.
- Key custody is the operator's problem and the documentation says so. A signature proves the holder of the key saw that head, not that the log is true.
- An operator with database access and the signing key can still rewrite history. The chain raises the cost and makes it detectable to anyone holding an earlier checkpoint.
- Backups and exports record the head hash they were taken at.

## Sources

- `docs/research/absorb/10-eventlog-storage.md` and `docs/research/absorb/19-github-scout.md` (the chain designs read at source level).
- ADR 0003; ADR 0010 and its amendments from card E2.6; `packages/core/src/plane/offboard.ts`.
- RFC 6962 (Certificate Transparency); C2SP tlog-checkpoint.
- `docs/tasks/lead-decisions.md`, item 49, and item 38 of 2026-11-20 (what an offboarding keeps).
