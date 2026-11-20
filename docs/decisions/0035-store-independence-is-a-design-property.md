# ADR 0035: Store independence is a design property, proven by request identity; H4 tests policy equivalence on GateMem only

Status: accepted, 2026-11-20, under the lead's delegation (`docs/tasks/lead-decisions.md`, items 20 and 24); the lead may overturn it
Deciders: the orchestrating session, under the lead's delegation of 2026-11-20
Supersedes: nothing. It narrows H4's design in `docs/research/preregistration.md` and Gate D's "two stores" criterion in `docs/roadmap.md`. The change reaches those files through the answers card.

## Context

- H4 claims that the plane's governance holds the same way on every store. As registered, it tests that with an equivalence test across a store family (files, Mem0 and Letta) on GateMem and on MemoryAgentBench.
- No condition uses a store's own search. ADR 0031, decision 2, has the plane read through its projection and rank in core. So the model's requests are byte-identical on every store, and the design review found this by construction (RV-DES-1, in `docs/log/2026-11-20-*`).
- A cross-store equivalence test therefore compares a quantity with itself plus sampling noise. It cannot fail for a reason the hypothesis names. Letta runs alone take days for nothing.
- MemoryAgentBench, H4's second arm, has no violation definition, and card B9 builds something other than what H4 needs (RV-DES-7).

## Decision

1. Store independence is a property of the design. The plane alone decides what reaches the model, so the model's requests do not depend on the store. A request-identity check proves it as a rule-9 result. It replays one configuration on every adapter, offline from cassettes, and compares the sha256 of every model request. Any difference fails it.
2. H4's equivalence test leaves the store family. H4 tests policy equivalence, the governance outcome across the presets it registers, on GateMem only.
3. Gate D's "two stores" criterion is met by the request-identity check on files, Mem0 and Letta, not by paid runs on each store.
4. Should a future condition let a store's own search reach the model, this ADR no longer holds. That condition would need its own ADR, reversing ADR 0031's decision 2, and the cross-store test would come back.

## Alternatives considered

- **Let H4 use each store's own search** (RV-DES-1, option b). This gives a real cross-store test. But it reverses ADR 0031, makes ranking store-specific and so harder to explain (ADR 0009), and adds weeks before Gate D.
- **Keep the registered test** and accept a likely null at the cost of the Letta runs. That spends days of runs and money on a result the design already guarantees.
- **Define a violation for MemoryAgentBench and rewrite card B9** (RV-DES-7, option b). That is new benchmark design before the tag, outside `docs/research/preregistration.md`'s list.

## Consequences

- H4 becomes cheaper and faster. Most of its priced cost was runs repeated per store (`research/results/h2-cost-table.json`, card RV8).
- A card builds the request-identity check, with a MANIFEST row.
- The answers card amends H4 and Gate D in the pre-registration and the roadmap, and removes MemoryAgentBench from H4's arms. Card B9 then needs rescoping.
- The thesis states store independence as a proven property of the design, not as a measured effect.

## Sources

- `docs/tasks/lead-decisions.md`, items 20 and 24, and the record of 2026-11-20.
- ADR 0031, decision 2; ADR 0009; ADR 0013.
- The design review's findings RV-DES-1 and RV-DES-7.
- `docs/research/preregistration.md`, H4.
