# Backlog

Work the lead has deliberately set aside. Nothing here blocks a card unless the card says so; taking an item off the backlog is a `decision` log entry.

| item | backlogged | what is left | where it stands |
|---|---|---|---|
| MPBench | 2026-10-22 by the lead; the request leaves the backlog by plan decision 6 (2026-10-29) | the lead sends the request in `docs/research/mpbench-request.md` if still wanted and records the date in `packages/bench/PINS.md`; the poisoning arm was chosen on 2026-10-29: MEM-INV-Bench (ADR 0029, Gate A exception (b)) | no release (S0.6); MEM-INV-Bench released, checked and recorded as a candidate (2026-10-29), then pinned in `packages/bench/PINS.md` and registered for H1 by the pre-registration's v1 draft, with MPBench moved to the candidates table (2026-11-03, plan decision 8; decision sheet item 15 of `docs/research/prereg-v1-decisions.md`); MPBench may return by amendment before card X3; cards B2 and BF1 |

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

The pre-registration left the backlog on 2026-11-02 (`docs/log/2026-11-02-r1-leaves-the-backlog.md`, plan `docs/tasks/prereg-v1-plan.md`). No experiment runs before `prereg-v1` is tagged: AGENTS.md forbids a benchmark, method or test that it does not register, and roadmap Gate C depends on it.

## Follow-ups from the Gate B plan, PR 5 review (2026-10-29)

Found by the review of card B3 (GateMem through the plane, ADR 0030); none blocks Gate B.

| item | what is left | where it is recorded |
|---|---|---|
| GateMem deletion mechanism | under ADR 0030's mapping C5 enforces no deletion, so GateMem's active-forgetting checkpoints, half of H1's primary violation set, test nothing the plane does; choose a mechanism (model-driven ingestion with a retire tool, or a deletion lint over turns) or state F as out of scope for C5. Needs the lead's decision before `prereg-v1` is tagged; the v1 plan's PR 2 measured the reachable-leak share, and PR 4's decision sheet recommends access control as H1's primary GateMem set and forgetting as a secondary set, with no mechanism built (item 9 of `docs/research/prereg-v1-decisions.md`) | ADR 0030 consequences; `docs/log/2026-10-29-b3-forgetting-not-enforced.md` |
| GateMem reachable-leak share | measured by the pre-registration v1 plan's PR 2: `research/results/h1-gatemem-reach.json`, from `research/scripts/h1_gatemem_reach.py` and `research/configs/h1-gatemem-reach.json`, the share of access and forgetting checkpoints whose scored leak patterns sit in turns the asker can read under ADR 0030's mapping, beside the shares the plane keeps out of reach | ADR 0030 consequences (review R5-2) |
| `@engram/bench` and `@engram/runner` import each other | bench's judge imports the runner's model code and the runner imports bench; a top-level use of one in the other breaks at load. Move the shared model types and the cached model call into a package both import, or into core where they are types | `docs/log/2026-10-29-b3-failure-bench-runner-import-cycle.md` |

## Follow-ups from the Gate B plan, other reviews (2026-10-29)

| item | what is left | where it is recorded |
|---|---|---|
| An untrusted-external provenance kind | no kind ranks untrusted outsiders below `tool`, so a trusted tool echoing web text stays `tool` and MEM-INV-Bench's echo channel (L-b) is not closed by inheritance; a schema change for the next schema PR | ADR 0029 amendments, `docs/log/2026-10-29-b4-trust-order-echo-stays-tool.md` |
| Action gating | the plane gates memory, not the consequential action MEM-INV-Bench scores; under `medium` every poisoned channel is admitted | `docs/log/2026-10-29-b4-plane-gates-memory-not-action.md` |
| Authentication for the HTTP and MCP surfaces | both listen on loopback only and take a self-asserted actor; compose gains `server` and `ui` with it | ADR 0027 |
| No-bypass false positives | the shell check refuses a bare store name, a double-quoted commit message naming it, and any command run from inside a store root | ADR 0014 amendments |
| Letta writes from `-a` committers | a client committing with `git commit -a` or after `git add -A` can carry an Engram item, and git's own race can revert one | ADR 0028 |

## Follow-ups from the pre-registration v1 plan (2026-11-03)

Found by the reviews of PRs #25 and #26; none blocks the v1 tag.

| item | what is left | where it is recorded |
|---|---|---|
| A read's `cut` count in the inspector | core's read reason records the admitted items a read limit cut (`ReadCounts.cut`, "N cut by the read limit"), and `parseReadReason` and the generated client carry it, but the inspector's explanation shows the returned, candidate and filtered counts and the filtered categories, not the cut; show the cut beside them (`packages/ui/src/App.tsx`) | `docs/log/2026-11-02-x1r3-read-reason-cut.md`; PR #25 review round 3, V-6 |
