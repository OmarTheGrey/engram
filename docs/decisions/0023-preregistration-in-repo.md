# ADR 0023: Pre-registration lives in the repo, tagged, and is mirrored externally

Status: accepted with amendments, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Nosek; the roadmap's Gate A requirement that v0 is committed and dated.

## Decision

`docs/research/preregistration.md` versioned and dated; each version is a git tag `prereg-vN`; the version that precedes the first real run is also deposited externally (OSF or Zenodo, whichever the supervisor prefers) so the date is independently attested. Changes after that are amendments with reasons, never edits.

Amendments made when deciding:

- Version v0 is tagged `prereg-v0` (2026-10-22); `prereg-v1` is the externally deposited version.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks R1, Gate A. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
