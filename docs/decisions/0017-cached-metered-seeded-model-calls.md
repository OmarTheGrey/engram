# ADR 0017: Every model call is cached, metered and seeded; cassettes are the cache

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

MERIT's full metering; the roadmap's compute ceiling; the testing convention's rule that no test reads the network.

## Decision

Cache key `(benchmark item, condition, preset, store, model, seed, prompt hash)`; value includes usage and cost from pi-ai; `ENGRAM_OFFLINE=1` refuses a miss. The cache directory is the cassette fixture set. Usage is written to a cost ledger in the event log so the frontier chart is derived, not computed by hand.

Amendments made when deciding:

- Implemented in S0.10: `ModelCall` is a type in core; the runner provides scripted, cached and pi-ai backed implementations; the cache key is (item, condition, preset, store, model, seed, prompt hash); `ENGRAM_OFFLINE=1` turns a miss into an error.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks X1, every experiment. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
