# ADR 0041: Policy is exported to Cedar for analysis and checked against it; the typed evaluator stays the authority

Status: proposed, 2026-11-21
Deciders: drafted by the absorb plan (`docs/tasks/absorb-plan.md`, card E2.12); for the lead's acceptance (`docs/tasks/lead-decisions.md`, item 52)
Supersedes: nothing. It would amend ADR 0006, which deferred Cedar to after the thesis.

## Context

- **ADR 0006 chose typed policy objects** evaluated by one pure function, and noted Cedar as "a credible v2 for the company": adopting it then would have added a language, a build step and a second explanation format.
- **What the typed policy lacks.** There is no independent statement of what the evaluator should do. The property tests check it against an oracle written by the same people.
- **What changed.** Cedar ships as a WebAssembly package (`@cedar-policy/cedar-wasm`, Apache-2.0) that runs in Node with no build step, and it has a formal semantics and an analyser that can prove statements about a policy set.
- **Constraints.** Rule 1 keeps policy logic in core. Core has no runtime dependency beyond the schema library. Every decision must still carry Engram's own reason.

## Decision (proposed)

1. **Export only.** A pure function in core, `exportCedar(policy)`, returns a Cedar schema and policy set as text. Core gains no runtime dependency.
2. **A differential test.** A property test generates actors, items and times, decides each request with `evaluateRead` and `evaluateWrite` and with the Cedar engine on the export, and requires agreement for the three presets. The Cedar package is a development dependency of that test.
3. **The evaluator is the authority.** Engram's decisions, reasons and events come from the typed evaluator. A Cedar policy is never loaded as input.
4. **A disagreement is a finding.** It is logged with its seed. The evaluator is changed only through its own card, with its own tests, never to make this test pass.
5. **Stated scope.** Grants are flattened at export, so agreement is claimed modulo grants. The test names every class of request it excludes and why.
6. **Analysis is a later step.** Proofs with Cedar's analyser (for example, that strict never allows a read medium denies) are a follow-up card once the export is trusted.

## Alternatives considered

- **Adopt Cedar as the evaluator.** One language with a formal semantics. It would replace the unit the invariants target, change every reason string, and put a WebAssembly engine in the write and read path.
- **Open Policy Agent and Rego.** Widely used, and a general-purpose language with no comparable analyser for this purpose.
- **A hand-written second evaluator.** An independent check with no dependency, written by the same people with the same blind spots.
- **Stay with ADR 0006's deferral.** Costs nothing. The thesis then has no independent check of its central function.

## Consequences

- Card E2.12 follows acceptance. It is on the product lane and is among the first cards cut if the plan runs late.
- A new development dependency, pinned exactly, in `docs/deps.md`.
- The export is also a feature: an organisation that uses Cedar can read Engram's policy in a language it knows.
- The translation of validity windows and time is the likely source of early disagreements.

## Sources

- ADR 0006.
- `docs/research/absorb/02-policy.md`; `docs/research/absorb/15-formal.md`.
- The Cedar language reference and its analysis papers.
- `docs/tasks/lead-decisions.md`, item 52.
