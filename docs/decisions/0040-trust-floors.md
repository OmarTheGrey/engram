# ADR 0040: Trust floors: an unattested write lands at the least trusted kind, and a less trusted source never changes or removes a more trusted item; both opt-in

Status: proposed, 2026-11-21
Deciders: drafted by the absorb plan (`docs/tasks/absorb-plan.md`, cards E2.7, E2.8 and E2.11); for the lead's acceptance (`docs/tasks/lead-decisions.md`, item 51)
Supersedes: nothing. It would amend ADR 0004 (decision D4: the plane sets provenance when the harness names a source) and ADR 0025 (the eviction order).

## Context

- **A write with no attested source keeps what it claims.** Under ADR 0004's decision D4, `Plane.write` replaces an item's provenance kind with the actor's `source` when the harness set one. When it set none, the caller's claim stands (`withPlaneProvenance`, `packages/core/src/plane/write.ts`). The pi extension, the CLI and adoption each set a source. A library caller, or a surface that forgets to, can claim kind `user`.
- **Trust may not protect an item from a less trusted writer.** The source-level readers of the GitHub sweep reported that budget eviction chooses its victim without regard to the victim's provenance kind, and that a rewrite can lower an item's kind. This was found by reading and is unconfirmed. Card E2.7 tests both before anything is changed.
- **What others do.** dent8 denies any operation by a lower authority on a higher authority's record, with an exhaustive lattice test. Veracium floors an unattested write to the least trusted kind.
- **What already holds.** Since card RV4, adoption never records a kind more trusted than the plane holds for the id (invariant 6). Since card RV7, only the owner rewrites a granted item or moves an item.
- **Constraint.** The registered conditions of H1 to H4 were specified with today's behaviour.

## Decision (proposed)

1. **Prove first.** Card E2.7 commits the counterexample tests. This ADR's second part is acted on only for what those tests confirm.
2. **The floor, `trust.unattested_floor`.** When on, a write whose actor has no `source` is recorded at the least trusted provenance kind, with a reason that says so, whatever the caller claimed. Every surface in the repository declares its source, so only a caller that names none is floored.
3. **Protection, `trust.protect_trusted`.** When on, a rewrite or a retire of an active item by a source less trusted than the item's kind is denied (`engram/write/downgrade`), and a budget eviction never chooses a victim more trusted than the write that triggered it. If no eligible victim remains, the triggering write is denied, with the reason.
4. **The owner is exempt.** The item's owner, acting with source `user`, may always rewrite or retire their own item.
5. **The trust order is the one core already has**: `TRUST_ORDER` in `packages/core/src/policy/promotion.ts`, which promotion and adoption (`leastTrusted`, card RV4) use. This ADR adds no second order.
6. **Opt-in, and off in the registered presets.** Both options default to off. The presets of H1 to H4 are unchanged, and a test asserts their decisions are byte-identical. A new preset turns both on.
7. **An eighth invariant.** With the options on: no committed item is more trusted than its actor's attested source, and no allowed write, eviction or retire by a less trusted source changes or removes a more trusted active item unless its owner acted.
8. **If a confirmed gap can change a registered number,** that is reported to the lead before the `prereg-v1` tag, as a finding, and the lead decides whether the registered conditions are amended.

## Alternatives considered

- **Fix the default.** The safest behaviour for a new user. It would move registered conditions and every fixture that relies on claimed provenance. It can become the default in a later schema version, after Gate D.
- **Refuse any write with no source.** Stricter than a floor, and it breaks every library caller and test that writes directly. The floor keeps them working at the lowest trust.
- **Leave eviction alone and raise budgets.** It hides the problem rather than fixing it: an agent could still push a person's memory out by writing enough.
- **Do nothing and document it.** ADR 0004 already documents the first behaviour. The thesis claims source isolation, and an examiner who reads the code will ask.

## Consequences

- Cards E2.8 (the schema options) and E2.11 (the behaviour and the invariant) follow acceptance.
- A workload under the new preset may see writes denied where today an old trusted item would be evicted. `engram simulate` shows the difference before anyone adopts it.
- Whether the eighth invariant belongs to Part I of the thesis is decided after Gate C.
- Verified actors (card E8.12) are a separate matter: a floor concerns what kind of content it is, not who the caller is.

## Sources

- `docs/research/absorb/19-github-scout.md`, findings GH-38 and GH-39; `docs/research/absorb/04-security.md`.
- ADR 0004 (decision D4); ADR 0007; ADR 0025; cards RV4 and RV7.
- dent8's ADR 0011; Veracium's unattested-write floor.
- `docs/tasks/lead-decisions.md`, item 51.
