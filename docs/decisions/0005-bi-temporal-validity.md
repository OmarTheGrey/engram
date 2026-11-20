# ADR 0005: Validity is bi-temporal; updates supersede, never overwrite

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
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
- Decision D7 (finding R5-8, PR #5): timestamps are compared at full precision by one helper in core, `compareTimestamps` in packages/core/src/time.ts: UTC ISO strings with a Z, the fractional seconds right-padded to nine digits (more when given), never through Date.parse, which truncates to the millisecond. The evaluator's validity window and grant expiry and the invariants' oracle all use it. Recency in the score still uses millisecond arithmetic; it ranks, it does not admit.

Amendment proposed by card RV5, 2026-11-20 (finding RV-CORE-3 of the core review and RV-SRF-2 of the surfaces review). Status: proposed, for the lead's acceptance; drafted by the card's agent.

- **The `valid_at` parameter is implemented, apart from the access clock.** `ReadQuery.valid_at` judges validity windows only; status, ttl, grant expiry and scoring are judged at the read's access time (`evaluateRead(policy, actor, item, at, validAt)`). Before, one `at` judged all of them against the current projection, so a time named in the past reopened what a grant's expiry had closed: Sam's grant expires 2026-12-19, a read at 2027-01-10 returns nothing, and a read named 2026-11-19, appended after it, returned the item, the log's timestamps running backwards.
- **An access decision is never judged before the log's head.** The log's head is the latest `ts` any of its events carries, compared as instants (`logHead`), not the `ts` of the event appended last: a write appended with an earlier `ts` does not move it back (review fix pass of PR #59, RV5-2). The read's access time, and its event's `ts`, is the time it was given, or the head when that is later (`accessTime`, `packages/core/src/plane/read.ts`, read under the log's lock). So no read is judged at an instant earlier than any event the log already holds; what holds is about reads only: a write or a sweep is still stamped at the clock it was given, which the surfaces own (ADR 0027, amendment of RV5). A time the caller named that is earlier is kept as the read's history time, its `valid_at`, and recorded apart from `ts` in the reason (`; validity windows judged at <time>`, `readValidAt`). The timeline (`POST /events`) judges what it shows at the same access time. A `valid_at` read sweeps nothing (ADR 0025, amendment of RV5).
- Not covered: writes, promotions and grant changes still take the time they are given; only the surfaces' server clock bounds them (ADR 0027, amendment of RV5).

## Alternatives considered

(a) `valid_from`, `valid_to` on the item, ingestion time on the event, an update creates a new version with `lineage` pointing back and sets `valid_to` on the old one. (b) Single timestamp and in-place edits.

## Consequences

Unblocks E1.2, L1, the LongMemEval update arm. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2605.06527-stale-benchmark.md`
- `docs/readings/litreview/2606.26511-memstrata-temporal-validity.md`
