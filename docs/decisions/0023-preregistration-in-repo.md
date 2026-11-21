# ADR 0023: Pre-registration lives in the repo, tagged, and is mirrored externally

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
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

Amendment of 2026-11-21, recording answers given on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`), carried by the answers card; the lead may overturn any:

- Item 18: the label audit runs from 23 to 28 November, and the lead tags `prereg-v1` and deposits it on Zenodo by 30 November; H1 runs from 1 to 8 December, on 4 shards.
- Item 27: the live cassettes are deposited on Zenodo too, with a fetch script checked by sha256 (ADR 0036).
