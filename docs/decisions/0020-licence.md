# ADR 0020: Licence

Status: accepted, 2026-10-22
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

The code needs a licence before the first external release, and the roadmap plans a public repository in week 23. The proposal left the choice to the owner.

## Decision

The code is licensed under the Apache License, Version 2.0. The full text is in `LICENSE` at the repository root, and the root `package.json` declares it.

## Alternatives considered

- MIT: the simplest, and what the roadmap first named for week 23; it has no patent grant.
- AGPL-3.0: protects a hosted product, but deters some adopters.

## Consequences

- Apache-2.0's patent grant covers contributors' patents in their contributions, which suits infrastructure a company may build on.
- The roadmap's week-23 line now names Apache-2.0.
- The licence of the thesis text and figures is not decided here; the proposal suggested CC BY 4.0.
- Current dependencies are compatible: MIT, Apache-2.0, and MPL-2.0 (Hypothesis, a development dependency of `research/`).

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/deps.md` (dependency licences)
