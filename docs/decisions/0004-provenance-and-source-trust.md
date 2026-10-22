# ADR 0004: Provenance model and source trust

Status: accepted with amendments, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Eywa's evidence, signal, belief layers; MPBench's four write channels and nine structural vulnerabilities, with write-path provenance in its unevaluated defence list; MINJA's query-only injection; HaluMem's finding that errors enter at extraction and update.

## Decision

(a). `kind: model` and `kind: compaction` are untrusted by default and cannot be promoted beyond person scope without a gate pass; pi `compaction` entries are the lowest trust because they are model-written summaries of mixed-trust content. The `hash` is of the evidence at write time, so the source-changed lint is a hash comparison. Trust levels live in policy, not in the item.

Amendments made when deciding:

- From the literature review (`docs/readings/litreview/sota-2026.md`; 2606.24322 Origin-Bound Authority): provenance is set by the system at write time and never claimed by the model.
- An item derived from others inherits the least trusted provenance of its inputs, so `compaction` provenance is a trust ceiling.

## Alternatives considered

(a) A `provenance` object: `{kind, ref, hash, actor, session_entry_id, model?}` with `kind` in {user, document, tool, model, import, compaction}. (b) A free-text source string.

## Consequences

Unblocks E1.2, E2.1, lints L1, seeded faults L2. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
- `docs/readings/litreview/2605.30771-eywa.md`
