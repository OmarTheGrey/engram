# ADR 0006: Scope, owner and grants; policy as typed objects, not a policy language

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

GateMem's principals writing into one pool and its leak-target annotation; the instruction hierarchy result that trained privilege still leaks; the requirement that every decision be explainable and simulable.

## Decision

(a) for the thesis. Cedar is a credible v2 for the company and is noted in the thesis as future work; it adds a language, a build step and a second explanation format now. The pure evaluator is the unit the invariants property tests target.

Amendments made when deciding:

- Made precise in S0.9 as the oracles of the invariants file: an actor is `{id, level, memberships}`; an item is readable when the actor is a member of its scope and the read matrix lets the actor's level read that scope's level, or when a live grant matches the actor (class and expiry honoured, `honour_grants` on).
- A write is forbidden when the rule for its scope level forbids its class or does not list its source kind.
- Calling context as a policy input remains open (`docs/architecture.md`, open items).

Amendments made in the review fix pass, 2026-10-25:

- D3, complete policies: a loaded policy has exactly one write rule and one read matrix row for each scope level (person, role, team, org). `parsePolicy` (`packages/core/src/policy/load.ts`) rejects a policy missing any, reported at the line of the `write` or `read.matrix` key and naming the missing levels; a second rule for one level was already rejected. The evaluator still default-denies a missing level, for policies built in code.
- Decision D4 (finding R5-5, PR #5): who may write. The actor must be a member of the item's scope (`actor.memberships` includes `item.scope`), and on a rewrite of an existing item id also of the scope the item has now; otherwise the write is denied with `engram/write/membership`. Grants are read permissions on existing items and never authorise a write, whatever their `mode`. Rewriting an item id requires the same `owner` and a `version` not lower than the projected one, otherwise `engram/write/version`. The invariants' write oracle forbids a write by a non-member of the item's scope and a write carrying a grant the gate refuses.
- Decision D6 (finding R5-9, PR #5): default denies have their own ids. No write rule for the item's scope level is `engram/write/default-deny`; no read matrix row for the actor's level is `engram/read/default-deny`, for the item decisions and for the read event.
- Not decided by D4, chosen by the fixer: membership in the current scope is also required on a rewrite, so a member of one scope cannot move another scope's item id into it; and the owner is compared as written, not against the actor's id, so a caller may still name another owner on a new item.

Amendments made when implementing card E2.5, 2026-10-29:

- Calling context as a policy input is absent in v1, and that is justified rather than left open (the literature review asks for one or the other, 2507.03724). The harness enters the decision through two inputs it sets and the caller cannot: `actor.source`, the provenance kind of what the actor writes (ADR 0004, decision D4), which also decides who may approve a promotion (ADR 0026); and `actor.memberships` with `actor.level`, which decide reach. A per-tool or per-task context (which tool is calling, on whose behalf, for what) would need a vocabulary of contexts and rules over them, which is a policy language; that is the v2 noted above (Cedar). The cost: two calls by the same actor from different tools are judged alike, so a harness that needs them apart must give them different actor ids or sources.

Amendment made by card RV7, 2026-11-20 (branch `rv7`, core review finding RV-CORE-2). Status: proposed, for the lead's acceptance:

- Only the owner moves an item. A rewrite whose scope differs from the projected item's is denied unless the actor is the projected item's owner (`engram/write/move`, in `evaluateWrite`, `packages/core/src/policy/evaluate.ts`); membership of both scopes, D4's rule, is still required as well. Before, a co-holder of a role could move the owner's granted item into the co-holder's own person scope: the owner then read nothing, the owner's grant change was refused as a non-member's (ADR 0034, decision 2), and the grantee kept reading through a grant nobody could remove. A writer who may not read the item's scope gets the opaque refusal of finding N3, naming neither scope nor owner. Promotion is unaffected: a promotion to another scope is a new version under a fresh id (ADR 0026), and the handover (card E9.7) changes the owner, not the scope. The alternative the review named, fixing the scope on every rewrite so items move only through promotion, would also take the move from the owner; it is narrower, and the lead may prefer it. Tests: `packages/core/test/unit/plane/write-grants.test.ts` ("RV-CORE-2"), and invariant 5's grant walk (moves by the owner and a co-holder).

## Alternatives considered

(a) Typed TypeScript policy objects: a read matrix over scopes {person, role, team, org}, grant records (`from`, `to`, `scope`, `class`, `expires`), write rules per (scope, class, source kind), retention budgets, promotion gates; evaluated by one pure function returning a decision with a reason. (b) Cedar through `cedar-wasm`. (c) OPA or Casbin.

## Consequences

Unblocks E2.1 to E2.5, the simulator, the invariants file. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2606.18829-gatemem.md`
- `packages/core/test/property/invariants.test.ts`
