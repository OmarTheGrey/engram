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
| Read events and utility | done on branch `schema-v1` (schema version 1): read events carry `item_ids`, and utility counts them | ADR 0025 amendment of 2026-11-06 |
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
| `@engram/bench` and `@engram/runner` import each other | done in PR #36 (merged 2026-11-13; built 2026-11-06): the cached model call and the scripted models moved to `@engram/model` (ADR 0033, proposed), which both import; bench no longer depends on the runner, and each loads alone (`packages/bench/test/load.test.ts`, `packages/runner/test/load.test.ts`) | `docs/log/2026-10-29-b3-failure-bench-runner-import-cycle.md`; `docs/log/2026-11-06-step1-model-package.md` |

## Follow-ups from the Gate B plan, other reviews (2026-10-29)

| item | what is left | where it is recorded |
|---|---|---|
| An untrusted-external provenance kind | the kind `external` exists on branch `schema-v1`, ranked last; what is left is labelling MEM-INV-Bench's `web` and `inbox` channels with it (ADR 0029), which changes the poisoning arm and waits for the pre-registration | ADR 0004 amendment of 2026-11-06 |
| Action gating | the plane gates memory, not the consequential action MEM-INV-Bench scores; under `medium` every poisoned channel is admitted | `docs/log/2026-10-29-b4-plane-gates-memory-not-action.md` |
| Authentication for the HTTP and MCP surfaces | both listen on loopback only and take a self-asserted actor; compose gains `server` and `ui` with it | ADR 0027 |
| No-bypass false positives | the shell check refuses a bare store name, a double-quoted commit message naming it, and any command run from inside a store root | ADR 0014 amendments |
| Letta writes from `-a` committers | a client committing with `git commit -a` or after `git add -A` can carry an Engram item, and git's own race can revert one | ADR 0028 |

## Follow-ups from the pre-registration v1 plan (2026-11-03)

Found by the reviews of PRs #25 and #26; none blocks the v1 tag.

| item | what is left | where it is recorded |
|---|---|---|
| A read's `cut` count in the inspector | core's read reason records the admitted items a read limit cut (`ReadCounts.cut`, "N cut by the read limit"), and `parseReadReason` and the generated client carry it, but the inspector's explanation shows the returned, candidate and filtered counts and the filtered categories, not the cut; show the cut beside them (`packages/ui/src/App.tsx`) | `docs/log/2026-11-02-x1r3-read-reason-cut.md`; PR #25 review round 3, V-6 |

## Follow-ups from the reviews of the twelve PRs merged on 2026-11-13

Found by the reviews of PRs #28 to #39 before they merged (`docs/log/2026-11-13-twelve-prs-merged.md`); none blocks a gate.

| item | what is left | where it is recorded |
|---|---|---|
| Lint from inside pi | `/engram lint` calls a `memory_lint` tool when the session has one, but `packages/pi-extension` registers none; L1 added lint to core, the server and the CLI only. A card should add the tool | ADR 0001, amendment of 2026-11-13; `docs/log/2026-11-13-px3-decision-template-detects-tools.md` |
| Session replay from a non-empty log | `replaySession` assumes the Engram log was empty when the session started; a session run against a log that held items, or a fork whose log keeps the abandoned branch's events, replays with differences. The acceptance's "zero model calls" holds by construction (replay takes no model function), not by a counter | `docs/log/2026-11-13-px2-review-policy-hash-and-resume.md` |
| Promoted items in a workload | a promotion's new item gets a replay id, not the recorded one, so a later step cannot name it and a promotion of a promoted item is not replayable | ADR 0032, amendment of 2026-11-13 |
| Conflicts with org knowledge before review | L1 lints active items only, and under the knowledge profile every team and org write lands as a candidate, so a duplicate of org knowledge is found only after promotion; a `Plane.lint` duplicate test under the profile is also missing. For L3 or E9.3 | `docs/log/2026-11-13-e9-1-review-fixes.md` |
| Knowledge and twin team sources | the knowledge profile's team rule admits tool and import sources, the twin profile's only user and document; the lead to confirm the difference is intended. Both profile tests repeat their load code, which a shared helper and a test that every `profiles/` file parses would replace | `docs/log/2026-11-13-e9-1-review-fixes.md` |
| Offboarding coverage | `offboard` is a core function, not a Plane method, so the invariant suite never calls it, and no surface calls it yet; a store failure's `error` text is the adapter's own and could in principle echo content | `docs/log/2026-11-13-e9-7-review.md` |
| LongMemEval split | the B5 fixture subset comes from the oracle file; the live baseline must vendor the cleaned S split the pre-registration names | `docs/log/2026-11-13-b5-review.md` |
| Version 0 workspaces | a workspace `policy.yaml` at schema version 0 stops loading after schema version 1 and is bumped by hand; utility counting by `item_ids` rode in the schema PR as the reason its field exists | ADR 0002; `docs/log/2026-11-13-schema-v1-review.md` |
| File URLs in tests | nothing stops a test from building a path from `URL.pathname` again, which breaks on a checkout path with a space | `docs/log/2026-11-13-fix-test-paths-with-spaces-review.md` |
| Letta delete refusals | the Letta adapter's `UnsafeLettaPathError` and `NotMemfsRepositoryError` are plain errors, not `NotDeletableError`, so offboarding keeps such an item back as a transient failure on every rerun; the adapter should mark the permanent ones | ADR 0010, post-merge amendment of 2026-11-13; `docs/log/2026-11-13-post-merge-failure-pr41-recheck.md` |
| Deletion report surfaces | no CLI command or server route reads a deletion report's `left_in_store`, so the person is not shown which store records to delete by hand | ADR 0010, post-merge amendment of 2026-11-13 |
| ADRs for the lead | ADRs 0031, 0032 and 0033 are proposed; the review amendments of 2026-11-13 to ADRs 0001, 0009, 0010, 0021 and 0032, and the corrected amendment sentence of ADR 0025, await the lead's acceptance | `docs/decisions/README.md` |
