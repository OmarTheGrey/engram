# ADR XXXX: The approval queue is a projection over the log; a decided or expired request closes its item's version

Status: proposed, 2026-11-28
Deciders: drafted by card E2.19 of the second absorb plan; for the lead's acceptance
Supersedes: nothing. It builds on ADR 0003 (the log is the source of truth), ADR 0026 (promotion and its reviewers), ADR 0049 (owner acceptance in a person scope), ADR 0041 (the Cedar export) and the plan decision of 2026-11-25 (`docs/log/2026-11-25-ap2-decision-approvals-without-schema.md`); it amends none of them.

## Context

Card E2.19 builds the policy's `approval` block (card E2.14: routes, each a level or one scope, typed approvers `owner`, `role:<id>`, `person:<id>`, an optional `expires_after`). The plan decided that a request is keyed by its candidate's id and version, with no event field. Several choices were left open, and card E8.8 (every surface and the inspector's queue) builds on whichever this card makes:

- where a request lives (events only, or a table of its own);
- what opens a request: only the `gate` ask Plane.promote appends, or also a write the gate held as a candidate;
- how an expiry is recorded without a clock in core or a timer anywhere;
- what an approver's refusal does to the item, and what a refused or expired request means for later promotions;
- how a route is chosen when two could apply, and how it composes with ADR 0026's reviewer rule and ADR 0049's owner acceptance.

## Decision

1. **Events only.** The queue is a pure function of the log (`approvalQueue` in `packages/core/src/plane/approvals.ts`): no table, no migration, no event field, no schema change. Plane.approvals reads it; nothing stores it.
2. **What opens a request.** The first of: an allowed `write` or `update` whose item lands as a candidate (a held write: a scope that requires review, the injection screen, a content guard, an import), with the item's scope as its target; or a `gate` ask from Plane.promote, with its `scope_to` as the target. A later ask on the same version joins the open request and neither reopens nor extends it. Under the knowledge profile every team and org write is a candidate, so a queue of asks alone would show nothing until someone tried to promote.
3. **What closes it.** Approved: an allowed `promote` of the item (in place, or a new version whose lineage starts at it). Expired: a `promote` deny under `engram/approval/expired`. Denied: an approver's refusal (`engram/approval/refused`), any other allowed retire, evict or erasure of the item, or a rewrite to another version.
4. **Expiry is an event at the injected clock.** The projection decides nothing: a pending request past its route's `expires_after` is marked `due`. The expiry is recorded by `Plane.expireRequests(actor, scope, at)`, a sweep by a member of the scope like `retain`, or by the evaluator when anyone promotes that version after its expiry: that deny event is the record. Nothing runs on a timer.
5. **A closed version stays closed.** Once a version's request expired or was refused, every promotion of that version is denied under the rule that closed it. A rewrite is a new version and so a new request, with its own expiry, the stale-base rule of obsidian-wiki's staging (MIT, `Ar9av/obsidian-wiki` at `7da8def05ab4`): a decision is about the version that was reviewed. An approver may also pin the version they reviewed (`reviewedVersion` on promote and refuse); a mismatch is refused under `engram/approval/stale`.
6. **Refusal.** `Plane.refuse(actor, itemId, reason, at)`: the refuser must be one who could approve. A held candidate is retired by one `retire` event under `engram/approval/refused` whose reason carries the approver's own reason, so the retired-content rule (ADR 0025) then keeps a model or tool from restating it in that scope; a refused widening is one `promote` deny, the active item left as it is.
7. **Routing.** A route naming the target scope beats one naming its level; the loader refuses two routes for one scope or level, so order never decides, and refuses `owner` on a route that is not a person scope. `person:<id>` names that principal, `role:<id>` every member of that role scope, `owner` the owner only where ADR 0049's acceptance holds. A route narrows and never widens: ADR 0026's reviewer rule (user-sourced, a member of the target, not the owner, not an author of any version, not a confirmer) is asked first, so no approver approves their own write, and its refusals keep `engram/promote/reviewer`; a reviewer the route does not name is refused under `engram/approval/route`.
8. **The Cedar export.** The export translates the read and write gates, not the promotion gate; the approval block changes neither, so a policy that sets it is exported, with one header line saying its routes are not exported (ADR 0041's list of what is not).

## Alternatives considered

- **A request table.** A row per request with its state would make the queue cheap to list, but it is a second source of truth beside the log and a migration; rejected under ADR 0003 and the plan's decision.
- **Asks only.** The card's goal text names the `gate` ask. It would leave a held write invisible until someone asks, which defeats Gate D's knowledge dogfood; held writes open requests too.
- **Expiry retires the candidate.** The research proposed retiring on the next retention sweep. A retire is a change to content's lifecycle that no person decided; a deny leaves the candidate held and its version closed, and its owner may rewrite it.
- **A refused request reopens on the next ask.** It would let a second approver override a refusal by waiting for a new ask on the same version; rejected for the same reason the stale-base rule exists.
- **A new rule id for self-approval** (`engram/approval/self`, as the research proposed). ADR 0026's reviewer rule already refuses it with a reason naming it; a second id for the same refusal would split one rule's audit trail.

## Consequences

- Card E8.8 builds the surfaces on Plane.approvals, Plane.refuse, Plane.expireRequests and `promote(..., { review: true, reviewedVersion })`; no route, MCP tool or CLI command is added here.
- The tenth invariant (`packages/core/test/property/approvals.test.ts`, run by `make test-invariants`): no candidate becomes active without an allow by a routed approver before its request expires, and every expiry is one event, never early.
- The oracle reads the approval block with its own code (`approvalAdmits` in `packages/core/src/oracle.ts`), so the twin dogfood's report judges a routed policy too.
- A policy without an approval block decides exactly as before; no registered preset or config sets one.
- Changing this decision needs a new ADR and a `decision` log entry.

## Sources

- `docs/tasks/E2.19.md`, `docs/tasks/absorb-plan-2.md` (section 5, entry 25), `docs/research/absorb/18a-approval-workflow.md`
- `docs/decisions/0003-event-log-and-sqlite.md`, `docs/decisions/0026-promotion-corroboration-and-review.md`, `docs/decisions/0049-owner-accepts-in-own-person-scope.md`, `docs/decisions/0041-cedar-export-for-analysis.md`, `docs/decisions/0025-retention-semantics.md`
- `obsidian_wiki/staging.py` of `Ar9av/obsidian-wiki` at `7da8def05ab46a68d4240201e898258a32312c60` (MIT)
