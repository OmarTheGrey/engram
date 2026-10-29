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

- Decision D5 (findings R5-1, R5-12): a read reveals nothing about items the reader cannot reach. Candidates are the projected items in a scope the reader may read (a member, and the matrix allows the level) or with a grant whose `to` matches the reader; the adapter's search is passed only the readable scopes the reader is a member of (amended in round 2, finding N1, below), and relevance from the store's order is ranked among admitted items only. `ReadResult.filtered` counts reachable candidates removed for status, validity or a grant's class or expiry. The read event's reason, the audit record, also counts the projected items out of reach; the event travels in the ReadResult and a harness keeps it from the model. A property test (packages/core/test/property/read-leak.test.ts) checks that adding unreachable items changes no item, explanation, score, rank or count.
- Decision D5: `explain(actor, readId)` returns the explanations only to the actor who made the read; another actor is refused with `ExplainDeniedError` and no event is appended (explain carries no injected time for one). Chosen over an empty result with a deny event.
- Finding R5-10: the cross-store acceptance test now reads with query text on every registered adapter, so each store's search is exercised and seen to receive only the reader's scopes.

Amendments made in round 2 of the review fix pass, 2026-10-28 (PR #5, verifier findings N1 and N5; pending the lead's review like the rest of this ADR):

- Finding N1: the limit the first round recorded here (a store whose search caps its hits, such as Mem0's topK, letting unreachable items in a granted item's scope crowd reachable ones out) is removed, not documented. The store is searched only in the readable scopes the reader is a member of. An item the reader reaches only through a grant is matched by the plane over the projection, scored by its share of the query terms exactly as on a store without search; store hits keep their relevance from the store's order, ranked among admitted store hits. No item the reader cannot reach is ever in a scope the store is searched in, so none can take a capped hit slot. A capped-search fake in packages/core/test/property/read-leak.test.ts (top one or two hits) runs the reviewer's probe and the non-interference property; both failed before the change.
- Finding N5 and decision D5's "live grant": no grant widens what the store is searched for, live or not. A grant matching the reader that has expired or names another class still makes its item a candidate, which the read filter removes and `filtered` counts, as D5 allows.

Amendments made in the review fix pass, 2026-10-25 (PR #7, findings R7-1 to R7-15; pending the lead's review like the rest of this ADR):

- Decision D11 (finding R7-2): only the Engram extension's own reads reach the model as governed memory. The extension records every memory tool result it produces in this process, keyed by tool call id (the actor, and for a read the read id and the admitted items), and every recall message it injects, keyed by read id. The `context` handler shows a memory result only when its tool call id is recorded for the current actor and its details (for a read) or text (otherwise) and error flag equal the record, and rebuilds it from the record. Every other result of a memory_* tool name is withheld: one whose call the extension never ran (another extension's tool of the same name, a call another handler blocked or pi rejected), one another extension's tool_result handler rewrote or flipped to an error, one recorded for another actor, and every result of an earlier process (a resumed session). Each withheld result is one `bypass_blocked` event (`engram/bypass/foreign-result`), logged once.
- Decision D11 (finding R7-8): item content in the tag is escaped (`&`, `<`, `>`, quotes), so stored text cannot open or close a tag or forge its attributes.
- Finding R7-15: pi's compaction and branch summaries send session messages to the model without the `context` event. The extension replaces memory results and recall messages with a notice in the messages pi summarises (`session_before_compact`, `session_before_tree`), so memory is not carried into summaries; the model reads again.
- Limit: a `context` or later handler of another extension that runs after Engram's can still change what is sent; an extension is code in the same process and can reach the store itself. The extension's tag.ts header says so.
- Finding R7-13: `memory_explain` is answered by `Plane.explain(actor, readId)`, which refuses another actor's read (decision D5); `memory_simulate` replays only the events this extension mirrored into the session.

Amendments made in the second review round, 2026-10-29 (PR #7, verifier report defects 3, 5 and 6; pending the lead's review like the rest of this ADR):

- Defect 3: in every message the extension did not rebuild (a file read, another tool's result, a user or assistant message, a bash execution, another extension's custom message, a summary), every tag opener (`<` or a lookalike, optional spaces, invisible characters and `/`, then `engram`) is defused to `&lt;`, in the `context` handler and in the messages compaction and branch summaries are made from. So the only Engram markup the model sees is what the extension rebuilt from its record. Chosen over a per-session secret nonce in the tag, which protects nothing unless the model checks it, while defusing depends neither on the model nor on any text the attacker controls. Thinking blocks (signed by the provider) and the system prompt are not defused.
- Defect 5: pi's `summarizeForBugReport` sends the session's messages to the model with no `context` event and no hook. The session now keeps no memory text: a memory_read result and a recall message are stored with a placeholder naming the read and its counts, the admitted items stay in the details (which pi never sends to a model) and in the extension's record, and the `context` handler still shows the model the tagged items. Limit: another extension can still write memory text into the session's messages itself, for example by rewriting a result in its tool_result handler.
- Defect 6: the branch-summary handler is tested in a real session (`navigateTree` with a summary): the summariser receives the notice in place of the recall, and a forged tag in a user message or another extension's custom message arrives defused.

Amendment made in PR 6 (Gate A), 2026-10-29, with ADR 0015's (pending the lead's review like the rest of this ADR):

- The memory tag the model receives carries the read id, the read rule, the filtered count and, per item, its id, scope, rank and admitting rule; it no longer carries the score total. The explanation itself (score components, rank, rule, grants, validity) is unchanged and is kept in the read's details, in the log and through `engram explain` (`Plane.explain`). In the product extension the model can also fetch it with `memory_explain`; in the runner's conditions, which offer only `memory_read` and `memory_write`, the model sees the rank and no score at all (review finding P6-4). The tag's shape is shared with the ungoverned conditions, which have no score (ADR 0015).

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E2.4, the inspector, the explanation evaluation. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
