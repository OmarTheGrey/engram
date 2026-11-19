# ADR 0034: A grant change is the owner's governed write: one update event, a new version in place

Status: proposed, 2026-11-19
Deciders: drafted by the orchestrating session's plan (docs/tasks/key-free-work-plan.md); for the lead's acceptance
Supersedes: nothing; it gives ADR 0021's consent grants the operation card E9.4's acceptance ("grant change recorded as an event") needs.

## Context

Grants live on each item (`Grant` in `packages/core/src/schema.ts`: `to`, `class`, `mode`, `expires`). The write gate checks every grant an item carries (ADR 0021, decision D4: a principal or a prefixed pattern, a class and an expiry, none on model or compaction content), and the read filter honours a live one. The twin profile (card E9.2) has no default grants. Until now no operation changed an item's grants: only a rewrite of the same item id through `Plane.write`, which any member of the scope may make, which sets the provenance from the rewriter's source, and which judges the whole item again under the write rule, though its content did not change. Plan decision 4 of `docs/tasks/key-free-work-plan.md` puts the operation in core, behind the gate, with no schema change (AGENTS.md rules 1, 3 and 5). ADR 0005, decision D1: rewriting the same id is an in-place update of that version, carrying a version not lower than the current one; a promotion's status change and an offboarding's handover (card E9.7) are such updates, with the version plus one.

## Decision

1. **The operation.** `Plane.changeGrants(actor, itemId, { add?, remove? }, at)` returns `{ decision, item, event }`. The pure gate is `evaluateGrantChange` in `packages/core/src/policy/grants.ts`; `packages/core/src/plane/grants.ts` checks the call and decides and commits in one slot of the write queue. A malformed actor, time, item id or grant, or a change that adds and removes nothing, is refused with `InvalidCallError` before the log is touched.
2. **Who may change a grant.** The item's owner (`actor.id === item.owner`), a member of the item's scope, and user-sourced. A grant is consent, a person's act: an agent acting for the owner (source `model`) is refused, as for offboarding. Checks in order: membership (`engram/grant/owner`, the same refusal for an unknown and a hidden item, naming no scope: decision D5), source (`engram/grant/source`), owner (`engram/grant/owner`), status (a retired item is refused, `engram/grant/status`, since the retired-content rule of ADR 0025 judges an item by the event that last changed it).
3. **What may change.** Every removal must name a grant the item carries, every field equal and the expiry compared as an instant (`engram/grant/unchanged`). Every addition must pass the write gate's own grant rule (`grantProblem`, under its id `engram/write/grant`), must not have expired at `at` (`engram/grant/expired`), and must not be on the item already (`engram/grant/unchanged`). A grant authorises reads only, whatever its mode (ADR 0006, decision D4).
4. **The new version and its event.** On allow, the item keeps its id, its version goes up by one, its grants become the kept ones followed by the added ones, and nothing else changes: content, provenance, validity and status stay. The item is rewritten to the store through the adapter, and one `update` event (`engram/grant/change`) carries the stored item, so replay rebuilds it; its reason names each grant added and removed and the version step. Every refusal is one `update` event of decision `deny`. No budget check runs: the counts do not change.
5. **The store.** A store failure after the gate allowed is one deny event under `engram/write/store-failure`. A transient failure is rethrown, as a write's is (decision D6). A store that refuses for good to rewrite the record (`NotDeletableError`, such as a Claude Code memory file the files adapter holds read-only) is a deny decision returned to the caller, since no retry would succeed.
6. **Surfaces.** `POST /api/v1/grants` (operation `changeGrants`) on the route table, in the generated client by `make api`. The inspector's grants editor (card E9.4) calls it as the viewer with source `user`, as `engram write` does; the actor stays self-asserted until authentication (ADR 0027, decision 5). No MCP tool and no pi tool: an agent's actor is model-sourced and would always be refused.

## Offboarding and adoption

- Offboarding (card E9.7): a handover makes the successor the owner of the leaver's role items and keeps their grants as they stand, so the successor may then change or remove them; erasing the person scope deletes its items with their grants. A grant naming the leaver as grantee, on another person's item, stays until it expires or its owner removes it.
- Adoption: the grants of a record the plane wrote are in the store (the files adapter keeps every field in the frontmatter), so adopting the folder after a grant change finds the store holding what the projection holds and appends nothing (`packages/adapters/test/plane/grants-files.test.ts`). A grant edited by hand in a file is adopted through the write gate like any field, D4 applying. A record the store holds read-only cannot carry a grant: the change is refused, see consequences.

## Alternatives considered

(a) Grants through `Plane.write` as it is: no new operation, but any member could change them, the provenance would become the changer's, the whole write rule would judge content that did not change, and no rule id would say that a grant changed. (b) Grants as policy records beside items (`from`, `to`, `scope`, `class`, `expires`, the alternative ADR 0006 lists): a schema change (rule 5), its own PR. (c) A new version under a fresh id with lineage, as a promotion's class or scope change: ADR 0005 keeps fresh ids for content that should keep history, and it would retire a version that is still the same memory. (d) Grants held by the plane only, never written to the store: adoption compares every field, so the store's copy would revert the grant on the next read, unless adoption learned to ignore grants; that is a change to adoption, and the route to granting Claude Code's own memory files (below).

## Consequences

- Card E9.4's acceptance holds in core (`packages/core/test/unit/plane/grants.test.ts`) and in Chromium (`test/e2e/twin.e2e.test.ts`); the twin dogfood (card E9.5) can start.
- A memory file Claude Code wrote cannot be granted: the files adapter holds it read-only, so the change is a deny event naming the store's refusal. In the dogfood a member grants items written through Engram. Granting Claude Code's own files needs (d), or a way for the owner to copy such a memory into an Engram item; either is a follow-up card.
- `Plane.write` still lets a member rewrite an item's grants (D4 checked). Narrowing it to the owner would change the invariants' write oracle, which the lead owns; it is left as a question with the recommendation to narrow it in a follow-up card.
- An allowed change is the item's last change for recency eviction (ADR 0025), so a grant refreshes recency; utility is unchanged.
- The lead-owned invariants file is untouched. The rule has its own property test (`packages/core/test/property/grants.test.ts`), which the lead may fold into invariant 2's oracle.

## Sources

- `docs/decisions/0005-bi-temporal-validity.md`, `docs/decisions/0006-scope-owner-grants-typed-policy.md`, `docs/decisions/0021-twin-scopes-and-grants.md`
- `docs/tasks/E9.4.md`; plan decision 4 of `docs/tasks/key-free-work-plan.md`
- `packages/pi-package/profiles/twin.yaml`
