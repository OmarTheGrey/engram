# ADR 0006: Scope, owner and grants; policy as typed objects, not a policy language

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

GateMem's principals writing into one pool and its leak-target annotation; the instruction hierarchy result that trained privilege still leaks; the requirement that every decision be explainable and simulable.

## Decision

(a) for the thesis. Cedar is a credible v2 for the company and is noted in the thesis as future work; it adds a language, a build step and a second explanation format now. The pure evaluator is the unit the invariants property tests target.

Amendments made when deciding:

- Made precise in S0.9 as the oracles of the invariants file: an actor is `{id, level, memberships}`; an item is readable when the actor is a member of its scope and the read matrix lets the actor's level read that scope's level, or when a live grant matches the actor (class and expiry honoured, `honour_grants` on).
- A write is forbidden when the rule for its scope level forbids its class or does not list its source kind.
- Calling context as a policy input remains open (`docs/architecture.md`, open items).

## Alternatives considered

(a) Typed TypeScript policy objects: a read matrix over scopes {person, role, team, org}, grant records (`from`, `to`, `scope`, `class`, `expires`), write rules per (scope, class, source kind), retention budgets, promotion gates; evaluated by one pure function returning a decision with a reason. (b) Cedar through `cedar-wasm`. (c) OPA or Casbin.

## Consequences

Unblocks E2.1 to E2.5, the simulator, the invariants file. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2606.18829-gatemem.md`
- `packages/core/test/property/invariants.test.ts`
