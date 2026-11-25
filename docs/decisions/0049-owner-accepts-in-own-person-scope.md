# ADR 0049: In a person scope only, its owner, acting as user, accepts a candidate of that scope; acceptance never raises trust

Status: accepted, 2026-11-25, under the lead's instruction of that day ("resolve the open items"); the orchestrating session decided it, and card E9.9 drafted and built it. The lead may overturn it.
Deciders: the orchestrating session, under the lead's instruction of 2026-11-25; drafted by card E9.9
Supersedes: nothing. It amends ADR 0026 (decision 3, the reviewer, and its rejected alternative "any member of the target scope as reviewer, owner included").

## Context

- **A person alone cannot read their own imports.** An import writes every row as a candidate, by the import actor `import:<importer>`, at no more than `import` trust and with its grants dropped (card E9.8, decision item 55). Under ADR 0026 a candidate becomes active only through a reviewer: a user-sourced member of the scope who is not the item's owner. In a person scope the owner is usually the only member, so the owner is refused (`engram/promote/reviewer`, "cannot approve its own item") and nobody else can approve (`docs/log/2026-11-21-e9-8-finding-person-scope-import-needs-reviewer.md`).
- **The injection screen's holds meet the same rule.** The screen (card E2.10, ADR 0039) holds content a person did not type as a candidate "until a person promotes it". A note the person's own agent wrote into the person scope and the screen held could be released only by somebody else.
- **The lead deferred it, then asked for it.** On 2026-11-22 the lead decided no ADR 0026 change before the `prereg-v1` tag (`docs/log/2026-11-22-e9-8-finding-owner-acceptance-after-tag.md`, the backlog row "An owner's acceptance of their own imported candidates"), because an owner's path could change promotion under the registered presets. On 2026-11-25 he asked for the open items to be resolved. Card E9.9 checked that no registered condition, fixture or result promotes in a person scope by its owner, so the rule can land before the tag without moving a registered byte.
- **Why ADR 0026 refused the owner.** Self-approval is the laundering channel of Authorization Laundering (2609.01836): an approval is an authorisation, and an agent writing its own approval grants itself authority. Origin-Bound Authority (2606.24322) requires elevation through an independent trusted principal. Both are about content gaining authority over others: a shared scope's readers, or a class that stands for corroborated knowledge.

## Decision

1. **Who may accept.** In a person scope only, the scope's owner may accept, meaning promote to active, a candidate in that same scope. The actor's id is the scope's id and the item's owner, its level is `person`, and its source is `user`. The owner asks for it as a reviewer asks (`review: true`, `engram promote --review`), so an owner who does not ask is judged as before.
2. **Where it does not apply.** Shared scopes (role, team, org) and any promotion out of the person scope keep ADR 0026's rule unchanged: a reviewer who is a user-sourced member of the target and neither owner, author nor confirmer. An episodic candidate is not accepted this way: its promotion is a class change to semantic, which stays corroboration by k distinct trusted actors or an independent review (crosswalk claim C46). A procedural candidate is not either: it needs its replay validation record, which no review replaces (ADR 0011, ADR 0046).
3. **Never through an agent.** The same request by the owner's id with any other source (`model`, `tool`, `compaction`, `document`, `import`, `external`, or none) is refused under `engram/promote/reviewer`, with a reason that names this rule. Inside pi and through the MCP server the agent acts as the person with source `model`, so it can never accept; neither surface exposes promotion at all.
4. **Trust.** Acceptance never raises trust or provenance. It is the in-place transition (same id, version plus one, status active): the item keeps the provenance kind the plane holds for it (`import`, `model` and so on), its provenance actor, its confidence, validity and grants. ADR 0040's floors still apply, and model, compaction and external content still never leaves the person scope (ADR 0004, ADR 0007).
5. **The holds.** An item the injection screen held may be accepted this way; its content is of a kind a person did not type, which carries no grants. An item the content guards held under `review` may be accepted this way only when it carries no live grant (ADR 0039 says a person promotes a held item). A guard-held item with a live grant would reach its grantees once released, so it keeps ADR 0026's independent reviewer: the owner is refused under `engram/promote/reviewer`, with a reason naming the live grants and the guard's rule id, and a second user-sourced member who does not own it may release it (amended in card E9.9's review fix pass, finding E99-2). The acceptance event's reason names the hold: the screen's own reason, or the guard's rule id.
6. **The event.** Acceptance is one `promote` event, actor the owner, under its own policy id `engram/promote/owner-person`, whose reason names the rule ("owner accepts in own person scope"), the acceptor, and the kind and confidence it kept (AGENTS.md rule 3). The decision is core's (`ownCandidate` and `evaluatePromotion` in `packages/core/src/policy/promotion.ts`); every surface passes `review` through.

## Why this does not reopen what ADR 0026 rejected

ADR 0026 rejected "any member of the target scope as reviewer, owner included" because the approval would authorise content for others. In the owner's own person scope it authorises nothing for anyone else: other readers reach a person scope only through a grant, and a grant is the owner's own consent (ADR 0034), which an import drops and model content never carries. The approval is user-sourced, so the agent cannot give it to itself. The item gains no class and no trust, so corroboration (C46) and source isolation are untouched. Leaving the person scope still needs an independent reviewer.

## Alternatives considered

- **Keep ADR 0026 and tell people to restate.** The person writes the memory again as a user write, which person scope admits active. It works, but it raises the imported content to `user` by retyping, the opposite of "never raises trust", and loses the import's provenance.
- **Admit imports active in a person scope.** Removes the step, but an import would then be readable without anyone looking at it, and it would not help the screen's holds.
- **Let the owner accept episodic candidates too.** The review path would make them semantic, so the owner alone would consolidate their own episodes without corroboration, which C46 rules out. Accepting them as active episodic items in place would be a second change to ADR 0026's transitions. Left out; the episodic case stays on the reviewer path.
- **A policy option, off in the registered presets.** A field on `promotion` is a schema change (AGENTS.md rule 5) for a rule no registered run reaches. Not taken.

## Consequences

- Card E9.9 implements it: core's evaluator, the oracle's own reading (`promotionPermitted` in `packages/core/src/oracle.ts`), invariant 2's draws around it, the dogfood report's rule list, the CLI's help and the promote route's tests.
- The limit ADR 0026's amendment P5-2 states for the CLI holds here too: the CLI does not authenticate, so through it an owner's acceptance is only as trustworthy as the single-user machine it runs on. On a served HTTP surface with credentials the source is the credential's (ADR 0042), so a key held for the agent cannot accept by sending `user`.
- Card E9.8's round trip promotes its person-scope rows as their owner, and only the team row through a reviewer.
- The TUI on branch `cliupgrade` labels `--review` "Approve as reviewer"; it should follow (`docs/log/2026-11-25-e9-9-finding-tui-promote.md`).
- Changing this decision needs a new ADR and a `decision` log entry.

## Sources

- `docs/decisions/0026-promotion-corroboration-and-review.md`, `docs/decisions/0039-content-guards-at-the-write-gate.md`, `docs/decisions/0040-trust-floors.md`, `docs/decisions/0042-verified-actors.md`, `docs/decisions/0034-grant-change-is-the-owners-governed-write.md`
- `docs/readings/litreview/2609.01836-authorization-laundering.md`
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
- `docs/log/2026-11-21-e9-8-finding-person-scope-import-needs-reviewer.md`, `docs/log/2026-11-22-e9-8-finding-owner-acceptance-after-tag.md`
