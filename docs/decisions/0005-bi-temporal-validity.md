# ADR 0005: Validity is bi-temporal; updates supersede, never overwrite

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Zep's event time versus ingestion time and edge invalidation; LongMemEval's knowledge-update category; PersonaMem's changing preferences; A-MEM's memory evolution rewriting notes with no lineage.

## Decision

(a). Reads default to the latest valid version at query time; a `valid_at` parameter returns history. The expired-validity lint is a comparison against the injected clock.

Amendments made when deciding:

- From the literature review (STALE 2605.06527, MemStrata 2606.26511, PFM 2610.10265): the expired-validity lint is reliable only on keyed items, so H3 is reported per class with keyed and unkeyed items counted separately.

Amendments made in the review fix pass, 2026-10-25:

- Decision D1 (review finding R2-2 on PR #2): a new version is a new item id whose `lineage` names the version it supersedes, and the versions may share one store_ref, so the store_ref index of migration 2 is not unique (edited in place, nothing had been persisted). A retired version keeps its ref. Looking an item up by ref returns the latest active holder, else the latest holder. Rewriting the same item id is an in-place update of that one version (a projection upsert), not a new version; it must carry a version number not lower than the current one, which the write gate enforces from card E2.3 (PR #5, decision D4). This narrows the title's "never overwrite" to: a change of content that should keep history is a new version.
- Refinement of D1 in review round 2, 2026-10-28 (finding N1, recorded in ADR 0002): looking an item up by ref returns the newest active version, the active holder no other active holder's lineage supersedes, so setting `valid_to` on a superseded version in place does not make it the holder again.

## Alternatives considered

(a) `valid_from`, `valid_to` on the item, ingestion time on the event, an update creates a new version with `lineage` pointing back and sets `valid_to` on the old one. (b) Single timestamp and in-place edits.

## Consequences

Unblocks E1.2, L1, the LongMemEval update arm. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2605.06527-stale-benchmark.md`
- `docs/readings/litreview/2606.26511-memstrata-temporal-validity.md`
