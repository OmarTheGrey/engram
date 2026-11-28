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
2. **What opens a request.** The first of: an allowed `write` or `update` whose item lands as a candidate (a held write: a scope that requires review, the injection screen, a content guard, an import), with the item's scope as its target; or a `gate` ask from Plane.promote, with its `scope_to` as the target. A request is keyed by the item's id, version and target, so one version may have a request into its own scope and another into a wider one, each with its own route and expiry; a later ask on the same version and target joins the open request and neither reopens nor extends it. Under the knowledge profile every team and org write is a candidate, so a queue of asks alone would show nothing until someone tried to promote.
3. **What closes it.** Approved: an allowed `promote` of the item into the request's target (in place, or a new version whose lineage starts at it). Expired: a `promote` deny into the target under `engram/approval/expired`. Denied: an approver's refusal (`engram/approval/refused`), any other allowed retire, evict or erasure of the item, a promotion of it into another target, or a rewrite to another version.
4. **Expiry is an event at the injected clock.** The projection decides nothing: a pending request past its route's `expires_after` is marked `due`. The expiry is recorded by `Plane.expireRequests(actor, scope, at)`, a sweep by a member of the scope like `retain`, or by the evaluator when anyone promotes that version after its expiry: that deny event is the record. Nothing runs on a timer.
5. **A closed version stays closed.** Once a version's request into a target expired or was refused, every promotion of that version into that target is denied under the rule that closed it. The rule is asked again inside the commit's transaction, under the log's lock, so a refusal or a recorded expiry that another handle appends between an approver's decision and their commit wins (a gate deny is not a change the staleness check counts). A rewrite is a new version and so a new request, with its own expiry, the stale-base rule of obsidian-wiki's staging (MIT, `Ar9av/obsidian-wiki` at `7da8def05ab4`): a decision is about the version that was reviewed. An approver may also pin the version they reviewed (`reviewedVersion` on promote and refuse); a mismatch is refused under `engram/approval/stale`.
6. **Refusal.** `Plane.refuse(actor, itemId, reason, at, { target?, reviewedVersion? })`: the refuser must be one who could approve that target's request. A held candidate refused in its own scope is retired by one `retire` event under `engram/approval/refused` whose reason carries the approver's own reason, so the retired-content rule (ADR 0025) then keeps a model or tool from restating it in that scope; a refused widening is one `promote` deny, the item left as it is. A pin is checked before anything else.
7. **Routing.** A route naming the target scope beats one naming its level; the loader refuses two routes for one scope or level, so order never decides, and refuses `owner` on a route that is not a person scope. `person:<id>` names that principal, `role:<id>` every member of that role scope, `owner` the owner only where an owner may decide alone: ADR 0049's acceptance of a semantic candidate, or card D5's own release of a procedure in its owner's person scope. A route narrows and never widens: ADR 0026's reviewer rule (user-sourced, a member of the target, not the owner, not an author of any version, not a confirmer) is asked first, so no approver approves their own write, and its refusals keep `engram/promote/reviewer`; a reviewer the route does not name is refused under `engram/approval/route`.
8. **The Cedar export.** The export translates the read and write gates, not the promotion gate; the approval block changes neither, so a policy that sets it is exported, with one header line saying its routes are not exported (ADR 0041's list of what is not).
9. **Without an approval block** the queue is still listed, and approval is ADR 0026's review exactly as before; the one new path that works without a block is `revalidate(..., { review: true })`, by which an ADR 0026 reviewer restores a drift-retired procedure in a scope that requires review (before, a restore there could only ask). Refusing and sweeping are new powers, so they are off: each is one deny under `engram/approval/off`, and nothing in the evaluator reads the queue. This keeps E2.14's rule that an absent block is today's review.
10. **A drift restore** (card D4, ADR 0050) in a scope that requires review is judged as the candidate it was, so the owner's presentation asks and opens a `restore` request on the retired procedure. An approver the route names restores it by presenting the replay with `review` (`Plane.revalidate`). Each presentation is judged afresh on its own replay: a new restore ask replaces an open restore request, and neither its expiry nor its refusal closes the version, so an expiry never strands the procedure beyond a new presentation.
11. **The current policy routes past requests.** Events record no policy version, so the queue reads routes and expiry from the policy it is given: a policy change moves the routing and expiry of requests still open, deterministically in (policy, log). The oracle reads it the same way.
12. **A person route names the owner.** Only the person is a member of their own scope, so a person route without `owner` would approve nothing and let every request expire; the loader refuses it.
13. **Card D5's safety-scan hold** is a `gate` ask, so it opens a request; with an approval block its release (`promote(..., { replay, release })`) is that request's approval, so after D5's own release rule (ADRs 0026 and 0049) the target's route must name the releaser, else `engram/approval/route`. `Plane.approvals` offers a decision (`may_decide`) only where the promotion gate would allow the actor's review; for a procedure, whose admission needs its replay, the approver rules answer.

## Alternatives considered

- **A request table.** A row per request with its state would make the queue cheap to list, but it is a second source of truth beside the log and a migration; rejected under ADR 0003 and the plan's decision.
- **Asks only.** The card's goal text names the `gate` ask. It would leave a held write invisible until someone asks, which defeats Gate D's knowledge dogfood; held writes open requests too.
- **Expiry retires the candidate.** The research proposed retiring on the next retention sweep. A retire is a change to content's lifecycle that no person decided; a deny leaves the candidate held and its version closed, and its owner may rewrite it.
- **A refused request reopens on the next ask.** It would let a second approver override a refusal by waiting for a new ask on the same version; rejected for the same reason the stale-base rule exists.
- **Refusal closes the item, not the version.** A rewrite, even of one character, is a new version and a new request, so an author can resubmit after a refusal. Accepted: every new version still needs a routed allow, and a refused candidate's content is retired-content in its scope, so a model or tool cannot restate it. The next approver does not see the earlier refusal unless a surface shows it; E8.8 can list an item's earlier refusals beside a new request from the log, with no schema change.
- **Refusal and sweeping under every policy.** Gathering refusals whatever the block would give any ADR 0026 reviewer a new power to retire another member's candidate under a policy that never asked for a queue; rejected for decision 9.
- **Requests keyed by version alone.** A widening ask joined the held write's request and inherited its route and expiry, so the wrong approvers were offered the decision; rejected (decision 2).
- **A new rule id for self-approval** (`engram/approval/self`, as the research proposed). ADR 0026's reviewer rule already refuses it with a reason naming it; a second id for the same refusal would split one rule's audit trail.

## Consequences

- Card E8.8 builds the surfaces on Plane.approvals, Plane.refuse, Plane.expireRequests, `promote(..., { review: true, reviewedVersion })` and `revalidate(..., { review: true })`; no route, MCP tool or CLI command is added here.
- The tenth invariant (`packages/core/test/property/approvals.test.ts`, run by `make test-invariants`): no candidate becomes active without an allow by a routed approver before its request expires, and every expiry is one event, never early.
- The oracle reads the approval block with its own code (`approvalAdmits` in `packages/core/src/oracle.ts`), so the twin dogfood's report judges a routed policy too.
- A policy without an approval block decides every existing call exactly as before, and refuses the two new ones (decision 9); no registered preset or config sets one.
- Changing this decision needs a new ADR and a `decision` log entry.

## Sources

- `docs/tasks/E2.19.md`, `docs/tasks/absorb-plan-2.md` (section 5, entry 25), `docs/research/absorb/18a-approval-workflow.md`
- `docs/decisions/0003-event-log-and-sqlite.md`, `docs/decisions/0026-promotion-corroboration-and-review.md`, `docs/decisions/0049-owner-accepts-in-own-person-scope.md`, `docs/decisions/0041-cedar-export-for-analysis.md`, `docs/decisions/0025-retention-semantics.md`
- `obsidian_wiki/staging.py` of `Ar9av/obsidian-wiki` at `7da8def05ab46a68d4240201e898258a32312c60` (MIT)
