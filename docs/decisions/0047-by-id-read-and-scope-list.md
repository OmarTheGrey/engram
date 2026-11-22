# ADR 0047: A by-id read and a scope list reveal no more than a read: an id out of reach or reached only through a grant that does not admit it answers as an unknown id; framework writes carry source model

Status: proposed, 2026-11-22
Deciders: drafted by card E8.14 of the absorb plan; for the lead's acceptance
Supersedes: nothing. It extends decision D5 of ADR 0009 (what a read reveals) to two new Plane methods, and adds two routes to ADR 0027's route table.

## Context

- **Framework seams need a key-value surface.** LangGraph's store asks for get by key and list namespaces, and other frameworks' memory interfaces ask for the same (research note `docs/research/absorb/12-frameworks.md`, AB-FWK-1). Card E8.14 adds `Plane.readById` and `Plane.listScopes`, their routes, a framework kit (`@engram/kit`) and the first adapter on it (`@engram/ai-sdk`).
- **A read reveals nothing about what the reader cannot reach** (ADR 0009, decision D5): its items, explanations, scores and `filtered` count depend only on what the reader can reach. A read of one id is a sharper probe: the reader names the id, so any difference between the answer for a held id and for an unknown one tells it the item exists.
- **`reachable` counts a matching grant before the filter judges it.** An item whose grant names the reader but is for another class, has expired, or sits on an item that is not active is a candidate of a read, removed by the filter and counted in `filtered`. For a read with text that is D5's accepted disclosure. For a by-id read it would say "this id is held" (review finding E8.14-1).
- **The schema may not change** (AGENTS.md rule 5): the op enum has no listing op, and read events have a null `item_id`.

## Decision

1. **A by-id read is the read path with at most one candidate.** `Plane.readById(actor, itemId, {at, valid_at?})` takes the projected item under the id, if the reader can reach it, through the same filter, explanation and read event as `Plane.read`; the store is never searched.
2. **What it reveals (the E8.14-1 rule, the lead's decision).** Before counting, a by-id read drops a candidate that the read filter does not admit and that is not in a scope the reader may read (`readableScope`): one reached only through a grant for another class, an expired grant, or a live grant on an item not active, past its ttl or outside its validity window. Such an id, an id in a scope the reader cannot reach, and an id the log never held all get the same answer, their responses and event reasons equal once the asked id and the event's own id and seq are made neutral. An item in a scope the reader may read is counted as any read counts it, since the reader may read that scope.
3. **A scope list lists what a read would show.** `Plane.listScopes(actor, at)` returns the actor's member scopes the read matrix lets its level read (`membership`), and the scope of every item a read now would admit through a live grant (`grant`), each once. Access is judged at the log's head when later than the time asked (ADR 0005 and 0027, card RV5), validity at the time asked, as a read judges them. A scope reached by a grant that admits nothing is not listed.
4. **Both are read events.** Each call appends one `read` event (AGENTS.md rule 3) under the actor's read rule. A by-id read's reason is the read reason with a last clause `; read by id <id>` (`readByIdTarget` reads it back; `readCounts` still parses it). A scope listing's names no item, carries no item ids, and starts with `scope list: `; the dogfood report counts it apart (`reads.scope_lists`), and judges as a read any such event that names an item. Only the event's maker sees either (`visibleEvents`).
5. **Two routes under `/api/v1`** (ADR 0027): `POST /read/{itemId}` (the body names the actor and an optional validity time; the response is the read's, and the store owner's sweep and adoption run first, as for `/read`) and `POST /scopes` (the body names the actor; the same sync runs first). Both are decisions answered with 200 and their event.
6. **Framework writes carry source `model`.** The kit copies and freezes the actor it is built with and sets its source to `model`, whatever it said (ADR 0004, decision D4), as the MCP server fixes its launch actor. No kit method takes an actor, a source, an owner or a provenance kind. An adapter on the kit reaches the plane only through the generated client, and its dependency closure holds no store, no server or CLI, and no pi package (ADR 0033), which the kit's conformance suite checks statically.

## Alternatives considered

- **Answer a by-id read with `filtered: 1` for a grant that does not admit**: what a read with text does. Rejected: the reader names the id, so the count confirms the item exists (E8.14-1).
- **Mark a by-id read in the event's `item_id`**: code elsewhere assumes a read's `item_id` is null, and the reader-facing record would then name an item the reader may not reach. The reason clause carries the same fact.
- **A new op for the scope list**: a schema change (rule 5); the prefix makes the events as easy to find.
- **List a member scope the matrix forbids, marked as such**: the actor knows its memberships, but listing it would invite reads that are always refused; the reason counts them instead.
- **Let the kit keep the caller's source**: an application writing through a framework could then write as `user`, which the write gate trusts more; the framework's writes are the agent's.

## Consequences

- Card E8.14 implements decisions 1 to 6 (`packages/core/src/plane/read.ts`, `scopes.ts`, `read-reason.ts`, `packages/server/src/routes.ts`, `packages/kit`, `packages/ai-sdk`). The invariants file's surface check classifies both methods, approved by the review of card E8.14 as second reviewer.
- A text read is unchanged. Its own disclosure through term shares over grant-reached items is recorded as a finding for the lead (`docs/log/2026-11-22-e8-14-finding-read-term-shares.md`), not changed: it is registered behaviour.
- A delete that maps to retirement (LangGraph's put of `None`) needs its own decision and ADR (ADR 0010); it is out of this card's scope.

## Sources

- ADR 0004 (decision D4), ADR 0005, ADR 0009 (decision D5), ADR 0010, ADR 0027, ADR 0033.
- `docs/tasks/E8.14.md`; `docs/tasks/absorb-plan.md`, pull request 30; `docs/research/absorb/12-frameworks.md`.
- The review of card E8.14, findings E8.14-1 to E8.14-6.
