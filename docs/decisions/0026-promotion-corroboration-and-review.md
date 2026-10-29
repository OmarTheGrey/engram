# ADR 0026: Promotion: confirmations are independent corroboration, reviewers are user-sourced members, a promotion is a write under the target's rule

Status: accepted, pending lead review, 2026-10-29
Deciders: drafted by the orchestrating session on the lead's instruction (plan `docs/tasks/gate-a-e0-e1-e2-plan.md`, decisions 3 and 4); pending review and acceptance by Omar (lead). Until then this records the design card E2.5 follows.
Supersedes: nothing; it gives ADR 0011 (one lifecycle, replay admission) its promotion mechanism.

## Context

The policy says episodic items become semantic "after k confirmations or review" and procedural candidates become active "after replay validation" (ADR 0011), and `Plane.promote(actor, itemId, toScope, at)` is declared, but nothing defines a confirmation, a reviewer, or how a promoted item is versioned. Two results constrain the design. Origin-Bound Authority (2606.24322) proves that any gate judging content or lineage is launderable, and names planted corroboration as one of the three laundering channels: an agent writing the same fact k times must not promote it; elevation is sound only through independent trusted principals. Authorization Laundering (2609.01836) shows an agent writing permissions into its own memory grants itself authority executors act on 98.6 percent of the time; an approval is an authorisation and must come from a user. Generative Agents (2304.03442) and Eywa (2605.30771) model consolidation as higher-level items that cite their evidence. MSCE (2607.16621) and SKILL.nb (2606.08049) activate skills on reliability scores and Wilson bounds; Engram's k of n is more conservative and has to say so.

## Decision

1. **A pure evaluator.** `evaluatePromotion(policy, actor, item, target, evidence)` in `packages/core/src/policy/promotion.ts`, with `evidence = { confirmations, review, validation? }`, decides with a reason and a policy id: `<policy>/promotion/episodic-to-semantic`, `<policy>/promotion/review`, `<policy>/promotion/procedural`, `engram/promote/membership`, `engram/promote/not-candidate`, `engram/promote/no-evidence`, `engram/promote/reviewer`.
2. **Confirmations** are counted from the log, never stored: allowed writes in the same scope of items whose normalised content hash equals the episodic item's (ADR 0018's exact rule), each by a different actor, with provenance kind `user`, `document` or `tool`. Writes with kind `model` or `compaction` never count (derived content cannot elevate, 2606.24322); the item's own write counts once. Promotion to semantic is allowed when the count reaches `promotion.episodic_to_semantic.confirmations`.
3. **Review.** When `or_review` holds, a reviewer may promote below k. A reviewer is a member of the target scope who is not the item's owner and whose actor source is `user` (set by the harness; a `model`-sourced actor cannot approve). The promote event's actor is the approver. A scope whose write rule has `requires_review` admits writes as `candidate`; promoting such a candidate to active is the same review path, so "review path records approver" holds for both.
4. **Procedural admission.** A procedural candidate becomes active only with a validation record `{ k, n }` where `k >= replay_k` and `n >= replay_n`; without one the promotion is denied (`engram/promote/no-evidence`). Card D3 supplies the record from replay. The preset comment states the one-sided Wilson upper bound on failure the chosen k of n implies, so the number is argued over, not assumed.
5. **A promotion is a write under the target's rule.** Widening scope or changing class is evaluated as a write of the promoted item into the target scope (membership, sources, classes, floor, review of decision D4 and ADR 0007), so a promotion never lands where a write could not; invariant 2's oracle covers promotions.
6. **Versioning.** A status-only transition (candidate to active) is in place: same id, version plus one, one `promote` event carrying the item. A class or scope change is a new id whose `lineage` names the source item and every confirming item (the evidence pointers of a reflection); the promoted item's provenance kind is the least trusted among its sources, its actor the approver or the promoting actor; the source is retired by a `retire` event (`<policy>/promotion/superseded`) in the same queue slot (ADR 0005, decision D1). A `derived_from` field on provenance (the trust ceiling the literature review asks for) is a schema change and waits for its own PR; lineage carries the pointers until then.
7. **Ask.** When `requires_review` holds and the actor is not a reviewer, the result is decision `ask` with a null item and one `gate` event, so the request is visible in the review queue (E8.8) without landing.

## Alternatives considered

- Confirmations by distinct provenance `ref` or `session_entry_id` only: launderable by one agent across sessions (channel L-c of 2606.24322). Rejected.
- Any member of the target scope as reviewer, owner included: self-approval; rejected on 2609.01836.
- A smoothed reliability score instead of k of n for procedures (MSCE): the score belongs on the item (D4, a schema change) and lands with drift detection; k of n is the admission rule until then.
- Promotion in place for class changes: loses the episodic evidence as a separate version (A-MEM's lineage-free evolution, 2502.12110); rejected under ADR 0005.

## Consequences

Card E2.5's acceptance ("fixture promotes only after k; review path records approver") has a definition. `engram promote` lands with it. Invariant 2 gains promotions; a second reviewer and a `decision` entry go with that change. The preset values for `confirmations`, `replay_k` and `replay_n` stay proposed. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/0011-one-lifecycle-replay-admission.md`, `docs/decisions/0004-provenance-and-source-trust.md`, `docs/decisions/0005-bi-temporal-validity.md`, `docs/decisions/0007-write-gate-and-source-isolation.md`
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
- `docs/readings/litreview/2609.01836-authorization-laundering.md`
- `docs/readings/litreview/2304.03442-generative-agents.md`, `docs/readings/litreview/2605.30771-eywa.md`
- `docs/readings/litreview/2607.16621-msce.md`, `docs/readings/litreview/2606.08049-skillnb.md`
- `docs/readings/litreview/2502.12110-a-mem.md`
