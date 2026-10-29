# ADR 0029: The poisoning arm runs on MEM-INV-Bench

Status: accepted, pending lead review, 2026-10-29
Deciders: drafted by the orchestrating session on the lead's instruction (plan `docs/tasks/gate-b-plan.md`, decision 3); pending review and acceptance by Omar (lead). Until then this records the choice cards B4 and X3 follow.
Supersedes: nothing; it settles Gate A exception (b) and plan decision 6 of `docs/tasks/gate-a-e0-e1-e2-plan.md`.

## Context

H1's second benchmark is a poisoning arm. Gate A exception (b) orders the choice: MPBench if released by Gate B, else MEM-INV-Bench, else the reconstruction of card BF1. MPBench (arXiv 2606.04329) has no code or data release (checked 2026-10-17 and 2026-10-29; the request to its authors is drafted, sending it is the lead's step). MEM-INV-Bench (arXiv 2606.24322) has code and data under MIT at commit `cf3c9a4` and on Hugging Face (checked 2026-10-29, `packages/bench/PINS.md`).

## Decision

1. The poisoning arm runs on MEM-INV-Bench, dated 2026-10-29. Card B4 builds it through the plane: the poisoned write crosses `Plane.write` with the provenance kind its origin channel implies, and the action-time read crosses `Plane.read`.
2. It is registered when the pre-registration leaves the backlog; the pre-registration already lists it under "Proposed amendments, not yet registered". Until then B4's config is a pipeline config and nothing runs as an experiment.
3. B4 vendors its fixture subset at `cf3c9a4` and the Hugging Face revision recorded in PINS.md; the row moves into the pinned table with the registration.
4. If MPBench is released before card X3 starts, the lead may add it by a `decision` entry and a pin PR (no experiment has started, so rule 8 allows it). BF1 stays the fallback's fallback.

## Alternatives considered

- Waiting until the end of week 6 to choose: nothing changes in the inputs except a possible MPBench release, which point 4 keeps open, and B4 could not start.
- BF1 now: a reconstruction from the paper's description, weaker than a released benchmark with recorded evidence.

## Consequences

The arm measures a different thing from MPBench's design: whether poisoned memory drives a consequential action past an authorisation monitor across laundering channels (self-summarisation, trusted-tool echo, manufactured corroboration), not whether a poisoned write is stored and later retrieved. H1's poisoning claim is stated in those terms, and the thesis says so. The plane's provenance and promotion rules (ADR 0004, ADR 0026) meet the paper's own defence on its own channels, which is a sharper test of them. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `packages/bench/PINS.md` (MPBench and MEM-INV-Bench rows, checked 2026-10-29)
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
- `docs/log/2026-10-29-gate-a-milestone-corrected.md` (exception (b))
- `docs/research/preregistration.md`, "Proposed amendments, not yet registered"
