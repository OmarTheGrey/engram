# ADR 0004: Provenance model and source trust

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Eywa's evidence, signal, belief layers; MPBench's four write channels and nine structural vulnerabilities, with write-path provenance in its unevaluated defence list; MINJA's query-only injection; HaluMem's finding that errors enter at extraction and update.

## Decision

(a). `kind: model` and `kind: compaction` are untrusted by default and cannot be promoted beyond person scope without a gate pass; pi `compaction` entries are the lowest trust because they are model-written summaries of mixed-trust content. The `hash` is of the evidence at write time, so the source-changed lint is a hash comparison. Trust levels live in policy, not in the item.

Amendments made when deciding:

- From the literature review (`docs/readings/litreview/sota-2026.md`; 2606.24322 Origin-Bound Authority): provenance is set by the system at write time and never claimed by the model.
- An item derived from others inherits the least trusted provenance of its inputs, so `compaction` provenance is a trust ceiling.
- The optional `model` field of option (a) is in the schema since the review fixes of 2026-10-22: it names the model that wrote `model` or `compaction` content.

## Alternatives considered

(a) A `provenance` object: `{kind, ref, hash, actor, session_entry_id, model?}` with `kind` in {user, document, tool, model, import, compaction}. (b) A free-text source string.

## Consequences

Unblocks E1.2, E2.1, lints L1, seeded faults L2. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
- `docs/readings/litreview/2605.30771-eywa.md`
