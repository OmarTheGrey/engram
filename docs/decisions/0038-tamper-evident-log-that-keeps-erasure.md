# ADR 0038: A tamper-evident event log that keeps erasure possible: a side-table hash chain over a content-free skeleton, with signed checkpoints

Status: accepted, 2026-11-21, under the lead's delegation of that day (`docs/tasks/lead-decisions.md`, item 49, option a); the lead may overturn it
Deciders: the orchestrating session, under the lead's delegation of 2026-11-21; drafted by the absorb plan (`docs/tasks/absorb-plan.md`, card E1.6)
Supersedes: nothing. It amends ADR 0003 (the event log is the source of truth) with a way to detect that the log was changed.

## Context

- **The log is trusted, and nothing protects it.** Every guarantee Engram gives is read off the event log: replay, explanation, the invariants, the dogfood report. The log is append-only by convention. A row edited in SQLite or Postgres is not detected by anything.
- **A plain hash chain breaks on erasure.** Offboarding (card E9.7, ADRs 0021 and 0010) redacts the content, the provenance reference and the evidence hash an erased item carries in every earlier event. A chain that hashes event bodies would stop verifying at the first erasure. Immutability and the right to erasure pull in opposite directions.
- **What exists to absorb.** The sweep found working designs under permitted licences: a hash chain with a genesis and a read-index cross-check (huqan, Apache-2.0), an ordered verifier with a tamper test matrix (world-model-mcp, MIT), Ed25519 signed head checkpoints (octopus-blackboard, Apache-2.0), and the tree and checkpoint formats of RFC 6962 and C2SP's tlog-checkpoint.
- **Constraints.** No change to the event body schema (rule 5 would make it a schema PR, and committed results hash event files). Core does no key I/O. Both Db backends.

## Decision

1. **A side table, not a new event field.** A table created in `packages/core/src/db/migrate.ts` holds, per event sequence number, the chain hash and what point 2 adds to it. `schema.ts` and the event bodies do not change, so every committed result and fixture stays byte-identical.
2. **The chain hashes the whole event, with the parts an erasure rewrites replaced by salted commitments.** The hashed record, the skeleton, is the event body in canonical form with exactly these parts swapped for commitments, because they are what `packages/core/src/plane/offboard.ts` rewrites:
   - in an event that carries an item: `item.content`, `item.provenance.ref`, `item.provenance.hash` and `item.provenance.session_entry_id` (the function `redacted`);
   - in a lint event: the evidence part of `reason`, after its `<lint id> (<severity>): ` head (the function `redactedLintReason`), or the whole reason when it has no such head. The head is hashed as it is.

   Everything else is hashed as it is: `id`, `seq`, `ts`, `op`, `item_id`, `actor`, `scope_from`, `scope_to`, `decision`, `policy_id`, `usage`, `item_ids`, `schema_version`, the reason of every event that is not a lint event (rule 3 makes the reason the audit trail), and every other field of `item` (owner, scope, class, status, confidence, validity, grants, lineage, version). A commitment is a hash of the part with a per-event random salt. The side table keeps, per event, the chain hash, the commitments and, until an erasure, the salts. The skeleton holds no content.
   - **The list cannot drift from the code.** A test redacts a generated event exactly as offboarding does and asserts its skeleton hash is unchanged, and asserts that any other single-field edit changes it. A new redaction in `offboard.ts` that the skeleton does not know fails that test.
3. **Erasure deletes the salts, and only a chained erasure counts.** When offboarding redacts an event it deletes that event's salts. The commitments stay, the chain still verifies, and without its salt a commitment reveals nothing about a low-entropy value.
   - **The manifest.** Each offboarding adds one record to the chain, with its erase events (`engram/offboard/erase`, one per erased item): the sorted sequence numbers of every event it redacted, item events and lint events alike. A lint event about another item, redacted because its evidence named an erased id or hash, is in the manifest too.
   - **The verifier's rule.** While an event has its salts, each commitment is recomputed from the event and must match. An event with no salts verifies as erased only when its sequence number is in a chained manifest and its redacted parts hold the redaction marker. A missing salt or a blanked part with no manifest entry is reported as tampering, so a redaction cannot be used to hide an edit.
4. **One canonical form.** A single function serialises the skeleton for the writer and the verifier: UTC timestamps at fixed precision, every number in one fixed textual form, keys in a fixed order, RFC 6962's leaf and node prefixes for domain separation.
5. **Anchors.** Each log has a genesis record. A meta row holds the head hash and the event count, so truncating the tail is detected. (Amended 2026-11-21 by card E1.6's review fix pass, finding E1.6-7: the meta row detects a truncated tail only when the row is left stale, since it sits in the same database. Anyone with database access who also rewrites the row, or the whole chain, is detected only by a checkpoint held outside the database; without one the verdict is UNSIGNED, never OK. See the amendments below.)
6. **Where the chain starts.** After the migrations that rewrote bodies in place, with a backfill checkpoint that records the sequence number it starts at. Events before it are stated as unchained.
7. **Signed checkpoints.** A checkpoint is the head hash, the count and a time, signed by a function injected at the boundary. Core holds no key. The CLI signs with an Ed25519 key the operator holds, and an unsigned checkpoint verifies as UNSIGNED, a verdict of its own.
8. **A new invariant.** In the always-on file: over random operations including an offboarding, an injected edit, deletion, reorder or tail truncation is detected, on SQLite and on Postgres.
9. **Independent of key destruction.** Erasure by destroying a per-person key (the research's plans R-083 to R-089) is a separate later decision and builds on this chain.

## Amendments

- **2026-11-21, card E1.6 review fix pass (the lead's decisions on findings E1.6-1, E1.6-4 and E1.6-10).**
  - Decision 5's "is detected" holds only for a stale head row (E1.6-7). The verifier and `engram log verify --help` say plainly what cannot be detected.
  - The verdict (decision 7): OK only when a signed checkpoint, verified under the pinned public key, covers the whole chain. UNSIGNED for anything less: no checkpoint, no key pinned, no signature that counts, or entries after the latest signed checkpoint. FAILED when a check fails. A checkpoint is signed only after the whole log verifies, under the signer's own key and every checkpoint the operator holds.
  - Chain links take a domain-separation prefix of their own, 0x02, distinct from RFC 6962's 0x00 leaf and 0x01 interior node, so no chain hash is a Merkle node; the checkpoint's RFC 6962 root is unchanged.
  - Decision 3's manifest also lists its erase events, and must: a manifest naming a redacted event names an erase event, and every item event it names is about an item one of its erase events erased.
  - The chain is kept by the shared opener (`openWorkspace().open()` in packages/server), so every surface chains its events; the card was widened to packages/server for this.
  - Card E8.12's `event_attestations` rows are outside the chain; an edited attestation verifies clean until a later card adds their digest to each event's chain record.
- **2026-11-28, card E1.9 (second absorb plan; for the lead's acceptance).** Builds on ADR 0042 decision 8 (the attestation side table) and changes nothing it decided.
  - Chain version 2. Each event's attestation row, written by the attesting handle in the statement call that appends the event, is digested (SHA-256 under the tag `engram.attestation.v1` over the row in canonical form) into that event's chain entry, beside its commitments, under the key `attestation`, in the same transaction. An event with no row carries no such key, and its record is version 1's.
  - A new chain's genesis says version 2. A chain begun under version 1 still verifies as it is: the first event a keeping handle appends to it is preceded by one `version` entry (`{"kind":"version","version":2}`), and attestations are chained from there on. Rows of events chained under version 1, or before the chain began, are counted as uncovered and named in a note; nothing vouches for them.
  - The verifier reads both versions: a version entry must raise the version by exactly one, to one it knows; a digest under version 1 fails the links. A new check, `attestations`, after `commitments`, fails on a row edited, deleted, added after its event was chained, or naming no event in the log.
  - The pi extension keeps the chain of a log that already has one on the handle it is given (E1.6's finding on unkept writers); a log with no chain, as a research run's, begins none.
  - What it cannot detect is unchanged: rewriting the genesis to version 1 and recomputing every link is a whole-chain rewrite, caught only by a checkpoint held outside the database.

## Alternatives considered

- **Hash the full event body.** Simple, and it makes erasure impossible or makes every erasure look like tampering.
- **A redaction record in the chain** (a digest-only chain where a redaction appends a record saying so). Workable, and it leaves the erased content's digest in place, which for a short value is guessable. Salted commitments close that.
- **An external transparency log or witness.** The strongest evidence, and it needs a service and a network. It can be added on top of signed checkpoints later.
- **Do nothing and state the limit.** Honest, and it leaves "every decision is logged" resting on an editable table.

## Consequences

- Card E1.6 implements this in the week the plan gives it (W14), after Gate C.
- A write costs one more hash and one more row, inside the transaction card E2.6 already serialises.
- Key custody is the operator's problem and the documentation says so. A signature proves the holder of the key saw that head, not that the log is true.
- The skeleton is defined against today's `offboard.ts`. A later change to what offboarding redacts changes this ADR's list in the same pull request, and the drift test fails until it does.
- An operator with database access and the signing key can still rewrite history. The chain raises the cost and makes it detectable to anyone holding an earlier checkpoint.
- Backups and exports record the head hash they were taken at.

## Sources

- `docs/research/absorb/10-eventlog-storage.md` and `docs/research/absorb/19-github-scout.md` (the chain designs read at source level).
- ADR 0003; ADR 0010 and its amendments from card E2.6; `packages/core/src/plane/offboard.ts`.
- RFC 6962 (Certificate Transparency); C2SP tlog-checkpoint.
- `docs/tasks/lead-decisions.md`, item 49, and item 38 of 2026-11-20 (what an offboarding keeps).
