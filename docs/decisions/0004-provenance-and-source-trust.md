# ADR 0004: Provenance model and source trust

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Eywa's evidence, signal, belief layers; MPBench's four write channels and nine structural vulnerabilities, with write-path provenance in its unevaluated defence list; MINJA's query-only injection; HaluMem's finding that errors enter at extraction and update.

## Decision

(a). `kind: model` and `kind: compaction` are untrusted by default and cannot be promoted beyond person scope without a gate pass; pi `compaction` entries are the lowest trust because they are model-written summaries of mixed-trust content. The `hash` is of the evidence at write time, so the source-changed lint is a hash comparison. Trust levels live in policy, not in the item.

Amendments made when deciding:

- From the literature review (`docs/readings/litreview/sota-2026.md`; 2606.24322 Origin-Bound Authority): provenance is set by the system at write time and never claimed by the model.
- An item derived from others inherits the least trusted provenance of its inputs, so `compaction` provenance is a trust ceiling.
- The optional `model` field of option (a) is in the schema since the review fixes of 2026-10-22: it names the model that wrote `model` or `compaction` content.

Amendments made in the review fix pass, 2026-10-25 (PR #5, findings R5-1 to R5-14):

- Decision D4 (finding R5-6): the plane, not the caller, sets provenance. `Actor` (packages/core/src/actor.ts) has an optional `source`, a provenance kind set by the harness: the pi extension sets `model` for agent tool calls, the CLI `user` for `engram write`, adoption `import`. When it is present, `Plane.write` overwrites `item.provenance.kind` with it and `item.provenance.actor` with the actor's id before the gate runs, and the event's item carries the overwritten provenance. When it is absent, the caller's provenance stands and the event's reason records "provenance as claimed by the caller". Callers that have not set `source` yet (the harnesses on later branches) keep the old behaviour, so the claim above holds only once each harness sets it.

Amendments made in the review fix pass, 2026-10-25 (PR #6, finding R6-2):

- Decision D8: adoption sets `source: import` itself and runs as the store's owner, so an adopted item's provenance is kind `import` with actor `person:<owner>`; the store's own record of who wrote it (for a Claude Code memory file, `agent:claude-code`) is replaced, and `provenance.ref` still names the file. The CLI sets `source: user` for `engram write`, which no longer takes a `--source` flag.
- Decision D4 (finding R5-7): an item whose provenance kind is model or compaction carries no grants; the write gate denies one that does (`engram/write/grant`).

Amendments made by the schema version 1 PR, 2026-11-06 (branch `schema-v1`):

- A seventh kind, `external`: content from an untrusted outsider (a public web page, an inbound mail, any feed a connector ingests from outside), the `untrusted_external` origin of MEM-INV-Bench's TMA-NM (2606.24322, Sec. IV). It ranks last in the trust order (`leastTrusted`, after compaction), so a trusted tool that echoes an outsider's text inherits `external` instead of staying `tool`, which closes the trusted-tool echo (channel L-b) by inheritance once a harness labels the outsider's content `external` (finding of card B4, `docs/log/2026-10-29-b4-trust-order-echo-stays-tool.md`).
- The gate treats it as it treats model and compaction content: it carries no grants, cannot leave person scope without a gate pass (`engram/write/source-isolation`), cannot restate retired content (ADR 0025) and never confirms a promotion (ADR 0026). No bundled preset lists it in `allowed_sources`, so until a policy does, every `external` write is denied as a source the rule does not allow.
- The kinds a harness sets are unchanged: no surface labels anything `external` yet. Mapping MEM-INV-Bench's `web` and `inbox` channels to it (ADR 0029, now `document`) changes the poisoning arm and is its own PR, after the pre-registration decides it.

Amendments made by card RV4, 2026-11-20 (branch `rv4`; proposed, for the lead's acceptance):

- Decision D8 narrowed: adoption never raises trust (backlog row "Adoption raises trust", found by card E9.5). A record whose content and provenance are as the plane holds them for its id keeps the plane's provenance, so a record the plane wrote is no new version and is not adopted again as `import` (backlog row "Re-adoption of plane writes"). Any other record, new to the plane or edited in the store, is recorded with the adopter as actor and the least trusted kind (the order of `leastTrusted`, `packages/core/src/policy/promotion.ts`) among the record's own claim, the plane's item of that id, and `import`. So an agent's `model` item stays `model` however often it is adopted, a record edited by hand is `import` at most, and a record whose frontmatter claims a more trusted kind than the plane holds gets the plane's. The reviewer proposed `leastTrusted([known.kind, "import"])`; the record's own claim is added because it can only lower the kind (`packages/core/src/plane/write.ts`, `adoptedItem`; `packages/adapters/test/plane/rv4-files.test.ts`).
- Review fix pass of PR #58 (I-5, I-3). A record new to the plane whose content (merging form) an item this same adoption retires holds, because the store no longer lists that item, also takes that item's kind into the least trusted: agent content re-filed under a new id with `kind: user` written into its frontmatter stays `model`, and the owner's grant on it is refused. And a hand-edited record that the gate denies only for its source (the source rule or source isolation), which would pass at the kind the plane holds its id at, leaves the plane's item standing: the deny is recorded and the item is not retracted. Before, the twin profile's team scope, which refuses `import`, retired the plane's approved item on any hand edit. The cost: the plane serves the version it approved while the store holds the edit, which the next allowed write of that item replaces. Invariant 6 checks that no adoption records a kind more trusted than the plane holds for the item's id (`packages/core/test/property/invariants.test.ts`; `packages/adapters/test/plane/rv4-review.test.ts`).
- Review fix pass 2 of PR #58 (N-2, N-1). The floor of the bullet above is taken from every retired item of the scope with the same content, as well as from what the adoption itself retires, so deleting the agent's file, adopting, and only then writing the re-filed copy no longer launders it (the copy is `model`, and the retired-content rule then refuses it). Invariant 6 judges a re-filed copy against the kind of the item it copies, including a copy that arrives an adoption later. And a plane item kept over a denied edit (I-3, I-4) is never found by the edit's text: a store search hit whose record no longer holds the projected content is matched by the plane over the projected content instead (`packages/core/src/plane/read.ts`, `matching`). The store's file keeps the owner's edit until the plane next writes that item (a rewrite or a grant change writes the projected version back); the plane does not restore it by itself, and the log keeps only the edit's hash. The floor has a cost (verification of fix pass 2): a person's own new file restating content an agent once wrote, after that agent item retired (by its ttl, say), is floored to `model` and then refused by the retired-content rule; the person can still write it through the plane as `user`. On a store whose search returns a capped number of hits (Mem0, 20), a hit dropped this way still takes one of them.

## Alternatives considered

(a) A `provenance` object: `{kind, ref, hash, actor, session_entry_id, model?}` with `kind` in {user, document, tool, model, import, compaction}. (b) A free-text source string.

## Consequences

Unblocks E1.2, E2.1, lints L1, seeded faults L2. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
- `docs/readings/litreview/2605.30771-eywa.md`

Amendment of 2026-11-21, recording answers given on 2026-11-21 under the lead's delegation (`docs/tasks/lead-decisions.md`), carried by the answers card; the lead may overturn any:

- Item 51: ADR 0040 amends decision D4. A write whose actor names no source keeps the provenance it claims today; card E2.7 proves the gap with tests first, and card E2.11 then adds an opt-in floor that records such a write at the least trusted kind, off in the H1 to H4 presets. If E2.7 confirms a gap that can move a registered H1 to H4 number, it goes to the lead before the `prereg-v1` tag (ADR 0040, decision 8).
- Item 55: an imported memory (card E9.8) is written by a dedicated import actor with provenance kind `import`, every row lands as a candidate, and grants are dropped. A bundle never states its own trust, as adoption never raises trust (this ADR's amendment of card RV4).
