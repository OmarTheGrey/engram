# ADR 0025: Retention semantics: expiry at read and by sweep, budgets enforced in the write queue, eviction order, retired content stays out

Status: accepted, pending lead review, 2026-10-29
Deciders: drafted by the orchestrating session on the lead's instruction (plan `docs/tasks/gate-a-e0-e1-e2-plan.md`, decision 5); pending review and acceptance by Omar (lead). Until then this records the design card E2.4 follows.
Supersedes: nothing; it gives ADR 0010 (retention never deletes) its mechanism.

## Context

ADR 0010 says retention retires and never deletes, because eviction is what makes budgeted memories lose at nine weeks (Ground Truth First, 2607.21962) and in-place repair damages benign memory (MemSecBench, 2607.27080). The policy already carries `retention` rules per scope and class (`ttl`, `budget`, `eviction` in recency, utility or manual) and the event log has both `retire` and `evict` ops, but nothing decides when a rule fires, who runs it, how `utility` is measured, or what `manual` does. Retrieval admissibility (2610.07309) names lifecycle as one of three axes a read must check, so an item past its ttl must be inadmissible even before a sweep retires it. Bemula (2610.18052) shows every memory system fails forget requests, partly through relearning: a similar later fact re-establishes what was removed; a retired item that stays as evidence is the one advantage of retire-over-delete, and it has to be used.

## Decision

1. **A pure evaluator.** `evaluateRetention(policy, scope, items, at, usage)` in `packages/core/src/policy/retention.ts` returns the retirements a sweep would make, each with a reason and the policy id `<policy>/retention/<level>/<class>`. No clock, randomness or store I/O. Timestamps compare through the full-precision helper (decision D7).
2. **Expiry.** An item whose `valid_from` plus `ttl` is not after `at` is expired. A read excludes it as a lifecycle exclusion (counted in `filtered`, reason `engram/read/ttl`), so a sweep that has not run yet cannot leak it; the sweep then retires it with op `retire`. Expiry never touches `valid_to`: ttl is retention, validity is truth (ADR 0005).
3. **Budgets.** A rule's `budget` bounds the active items of that class in that scope. The write path runs the budget check for the written scope and class after a landing write, in the same queue slot, so after any write sequence no scope holds more active items of a class than its budget. Overage is retired with op `evict`, in the rule's order: `recency` retires the oldest by the seq of their last changing event; `utility` retires the least read, measured as the count of explanation rows naming the item (migration 3: every item a read returned), ties broken by recency; `manual` evicts nothing and appends one `evict` event with decision `ask`, `item_id` null, naming the overage, so a human sees it in the session and the inspector and every decision stays an event (AGENTS.md rule 3).
4. **The sweep.** `Plane.retain(actor, scope, at)` runs both checks over one scope and returns a `RetentionReport`. The actor must be a member of the scope (`engram/retention/membership`). It runs inside the write queue so it never interleaves with a write. The pi extension calls it after an allowed write to that scope and at `before_agent_start` for the session's scopes; `engram read` calls it before adoption. Nothing runs on a timer: the plane has no clock.
5. **Retired content stays out.** A write whose actor source is `model`, `compaction` or `tool` is denied (`engram/write/retired-content`) when an item retired in the same scope has the same normalised content hash (ADR 0018's exact rule). A `user`, `document` or `import` source may re-admit it: a person restating a fact is a new user event, which is what Bemula's relearning suite requires. The near-duplicate form of this rule waits for the duplicate lint (L1, ADR 0018).
6. **Reinstatement** is an allowed `update` event that sets `status` back to active on the retired version (ADR 0010); no new Plane method in E2.4, and a follow-up card names the surface for it.

## Alternatives considered

- Deny a write that would exceed the budget instead of evicting: contradicts ADR 0010's reading of the tenure crossover (the new material is what the agent needs now) and the preset comments; not taken.
- Utility as an LLM-rated importance score (Generative Agents, 2304.03442): a model call on the plane's write path, against AGENTS.md rule 4; reads-returned is the deterministic proxy MERIT's marginal-utility framing supports (2609.05441).
- A background timer for expiry: core reads no clock; surfaces inject `at`.
- Deleting on budget overage: ADR 0010.

## Consequences

Card E2.4's acceptance ("budget exceeded evicts per policy; events recorded") has a definition. The lead-owned invariants gain a fifth property (budget never exceeded after any write sequence; every retire or evict carries a reason and a policy id; replay reproduces them) and invariant 1's oracle excludes expired items; a second reviewer and a `decision` entry go with that change. The preset ttl and budget numbers stay proposed values. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/0010-retention-retires.md`, `docs/decisions/0005-bi-temporal-validity.md`, `docs/decisions/0018-duplicates-without-embeddings.md`
- `docs/readings/litreview/2607.21962-ground-truth-first.md` (tenure crossover)
- `docs/readings/litreview/2610.07309-retrieval-admissibility.md` (lifecycle as an admissibility axis)
- `docs/readings/litreview/2610.18052-bemula-unlearning.md` (relearning and extraction suites)
- `docs/readings/litreview/2609.05441-merit.md` (utility accounting)
- `docs/readings/litreview/2304.03442-generative-agents.md` (recency and importance in retrieval)
