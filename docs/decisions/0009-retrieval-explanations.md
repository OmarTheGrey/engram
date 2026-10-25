# ADR 0009: Retrieval explanations carry score components, rank and policy decision

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Generative Agents' scored retrieval (recency, importance, relevance); Lost in the Middle (rank is part of the outcome); MERIT (agents act on a retrieved value only about half the time, so what was returned and where must be inspectable).

## Decision

Every `Plane.read` returns items with an `explanation`: score components, rank, the policy rule that admitted the item, grants used, and the validity window applied. The same record is what the inspector shows and what `custom_message` carries into the model when policy allows.

Amendments made when deciding:

- Implemented as the Explanation schema in S0.7: score total and components, rank, the admitting `policy_id`, grants used, and the validity window applied.

Amendments made in the review fix pass, 2026-10-25 (PR #5, findings R5-1 to R5-14; pending the lead's review like the rest of this ADR):

- Decision D5 (findings R5-1, R5-12): a read reveals nothing about items the reader cannot reach. Candidates are the projected items in a scope the reader may read (a member, and the matrix allows the level) or with a grant whose `to` matches the reader; the adapter's search is passed only those scopes, and relevance from the store's order is ranked among admitted items only. `ReadResult.filtered` counts reachable candidates removed for status, validity or a grant's class or expiry. The read event's reason, the audit record, also counts the projected items out of reach; the event travels in the ReadResult and a harness keeps it from the model. A property test (packages/core/test/property/read-leak.test.ts) checks that adding unreachable items changes no item, explanation, score, rank or count.
- Decision D5: `explain(actor, readId)` returns the explanations only to the actor who made the read; another actor is refused with `ExplainDeniedError` and no event is appended (explain carries no injected time for one). Chosen over an empty result with a deny event.
- Limit: a store whose search caps its hits (Mem0's topK) can let unreachable items in a granted item's scope crowd reachable ones out of the hit list; the plane cannot see that from the results. Only scopes the reader can reach are searched, so the effect is confined to scopes shared through a grant.
- Finding R5-10: the cross-store acceptance test now reads with query text on every registered adapter, so each store's search is exercised and seen to receive only the reader's scopes.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E2.4, the inspector, the explanation evaluation. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
