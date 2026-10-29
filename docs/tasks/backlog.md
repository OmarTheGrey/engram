# Backlog

Work the lead has deliberately set aside. Nothing here blocks a card unless the card says so; taking an item off the backlog is a `decision` log entry.

| item | backlogged | what is left | where it stands |
|---|---|---|---|
| Pre-registration v1 | 2026-10-22 by the lead | confirm H1 to H5 (reconstructed, since the proposal was not in the repository), the proposed thresholds, three models from three providers and H4's sample size; then tag `prereg-v1` and deposit it externally (ADR 0023) | v0.2 (2026-10-25) in `docs/research/preregistration.md`, tag `prereg-v0`; card R1 |
| MPBench | 2026-10-22 by the lead; the request leaves the backlog by plan decision 6 (2026-10-29) | the lead sends the request in `docs/research/mpbench-request.md` if still wanted and records the date in `packages/bench/PINS.md`; the poisoning arm was chosen on 2026-10-29: MEM-INV-Bench (ADR 0029, Gate A exception (b)) | no release (S0.6); MEM-INV-Bench released, checked and recorded as a candidate in `packages/bench/PINS.md`, not pinned (2026-10-29); cards B2 and BF1 |
| ADR review and flesh-out session | 2026-10-22 by the lead | review ADRs 0002 to 0026 (except 0020) with the team: accept, amend or reject each and flesh out the drafts; confirm the `org`-membership read rule (ADR 0006, `packages/core/test/property/oracle.ts`) and whether schema v0 changes bump `schema_version` | drafted as "accepted, pending lead review" in S0.13 |

## Follow-ups from the Gate A plan (2026-10-29)

Found by the reviews of PRs #10 to #15 and left open on purpose; none blocks Gate B.

| item | what is left | where it is recorded |
|---|---|---|
| `engram retain` | done on branch gb-pr3-surfaces (plan PR 3): `engram retain --scope <scope>` sweeps one scope as a user-sourced member | ADR 0025 amendments; `docs/log/2026-10-29-e8-2-cli-on-the-client.md` |
| CLI identity | `--as` and `--member` are self-asserted; promotion's distinct-actor and reviewer rules hold only as far as the machine does | ADR 0026, `engram promote --help` |
| Budget flooding | an untrusted member can flood a scope until a target item is evicted, after which models cannot restate it | ADR 0025 amendments |
| Eviction event to non-readers | the event carries the evicted item's id to a writer who cannot read the scope (kept for replay and log-session equality) | ADR 0025 amendments |
| Whitespace payloads in promotion | trailing space and tab patterns, and U+2800, survive the strict form (review P5-19) | `docs/log/2026-10-29-gate-a-plan-done.md` |
| CLI path spellings in pi bash | done on branch gb-pr3-surfaces (plan PR 3): words are also read as normalised paths, and `../cli` and `cli/src/main.ts` are blocked; the check now lives in core | ADR 0014 amendments |
| Read events and utility | record the returned item ids on read events, so utility evictions replay from the log | the plan's "not now" list (next schema PR) |
| Read reason grammar | core's read reason says "1 projected item outside the reader's reach were not candidates"; the verb should follow the count, changed with its parser (`formatReadReason`, `parseReadReason`) and the inspector, which reads it through them | PR 4 review (#22), outside list |
| Schema items | `derived_from`, procedural reliability, a lifecycle-trigger field, superseding-version id in explanations, `volatility` | the plan's "not now" list |

The GateMem live run (card B1) waits on the pre-registration; its judge is ported and `make bench BENCH=gatemem DRY=1` counts its calls (Gate A exception (a)).

Until the pre-registration leaves the backlog, no experiment runs: AGENTS.md forbids a benchmark, method or test that it does not register, and roadmap Gate C depends on it.

## Follow-ups from the Gate B plan, PR 5 review (2026-10-29)

Found by the review of card B3 (GateMem through the plane, ADR 0030); none blocks Gate B.

| item | what is left | where it is recorded |
|---|---|---|
| GateMem deletion mechanism | under ADR 0030's mapping C5 enforces no deletion, so GateMem's active-forgetting checkpoints, half of H1's primary violation set, test nothing the plane does; choose a mechanism (model-driven ingestion with a retire tool, or a deletion lint over turns) or state F as out of scope for C5. Needs the lead's decision before the pre-registration leaves the backlog | ADR 0030 consequences; `docs/log/2026-10-29-b3-forgetting-not-enforced.md` |
| GateMem reachable-leak share | a `research/scripts/` measurement, from a `research/configs/` config, of the share of access and forgetting checkpoints whose leak targets sit in turns the asker can reach under ADR 0030's mapping: an upper bound on what C5 can prevent. Not written yet | ADR 0030 consequences (review R5-2) |
| `@engram/bench` and `@engram/runner` import each other | bench's judge imports the runner's model code and the runner imports bench; a top-level use of one in the other breaks at load. Move the shared model types and the cached model call into a package both import, or into core where they are types | `docs/log/2026-10-29-b3-failure-bench-runner-import-cycle.md` |

## Follow-ups from the Gate B plan, other reviews (2026-10-29)

| item | what is left | where it is recorded |
|---|---|---|
| An untrusted-external provenance kind | no kind ranks untrusted outsiders below `tool`, so a trusted tool echoing web text stays `tool` and MEM-INV-Bench's echo channel (L-b) is not closed by inheritance; a schema change for the next schema PR | ADR 0029 amendments, `docs/log/2026-10-29-b4-trust-order-echo-stays-tool.md` |
| Action gating | the plane gates memory, not the consequential action MEM-INV-Bench scores; under `medium` every poisoned channel is admitted | `docs/log/2026-10-29-b4-plane-gates-memory-not-action.md` |
| Authentication for the HTTP and MCP surfaces | both listen on loopback only and take a self-asserted actor; compose gains `server` and `ui` with it | ADR 0027 |
| No-bypass false positives | the shell check refuses a bare store name, a double-quoted commit message naming it, and any command run from inside a store root | ADR 0014 amendments |
| Letta writes from `-a` committers | a client committing with `git commit -a` or after `git add -A` can carry an Engram item, and git's own race can revert one | ADR 0028 |
