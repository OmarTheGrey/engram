# Backlog

Work the lead has deliberately set aside. Nothing here blocks a card unless the card says so; taking an item off the backlog is a `decision` log entry.

| item | backlogged | what is left | where it stands |
|---|---|---|---|
| Pre-registration v1 | 2026-10-22 by the lead | confirm H1 to H5 (reconstructed, since the proposal was not in the repository), the proposed thresholds, three models from three providers and H4's sample size; then tag `prereg-v1` and deposit it externally (ADR 0023) | v0.1 in `docs/research/preregistration.md`, tag `prereg-v0`; card R1 |
| MPBench | 2026-10-22 by the lead | send the request in `docs/research/mpbench-request.md` and record the date in `packages/bench/PINS.md`, or build the fallback | no release (S0.6); cards B2 and BF1 |
| ADR review and flesh-out session | 2026-10-22 by the lead | review ADRs 0002 to 0023 (except 0020) with the team: accept, amend or reject each and flesh out the drafts; confirm the `org`-membership read rule (ADR 0006, `packages/core/test/property/oracle.ts`) and whether schema v0 changes bump `schema_version` | drafted as "accepted, pending lead review" in S0.13 |

Until the pre-registration leaves the backlog, no experiment runs: AGENTS.md forbids a benchmark, method or test that it does not register, and roadmap Gate C depends on it.
