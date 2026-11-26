# Backlog

Work the lead has deliberately set aside. Nothing here blocks a card unless the card says so; taking an item off the backlog is a `decision` log entry.

| item | backlogged | what is left | where it stands |
|---|---|---|---|
| MPBench | 2026-10-22 by the lead; the request leaves the backlog by plan decision 6 (2026-10-29) | the request in `docs/research/mpbench-request.md` is not sent; the lead left that default standing on 2026-11-19 (`docs/log/2026-11-19-lead-decision-mpbench-not-sent.md`), it was kept on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 48), and MPBench stays a candidate in `packages/bench/PINS.md`; the poisoning arm was chosen on 2026-10-29: MEM-INV-Bench (ADR 0029, Gate A exception (b)) | no release (S0.6); MEM-INV-Bench released, checked and recorded as a candidate (2026-10-29), then pinned in `packages/bench/PINS.md` and registered for H1 by the pre-registration's v1 draft, with MPBench moved to the candidates table (2026-11-03, plan decision 8; decision sheet item 15 of `docs/research/prereg-v1-decisions.md`); MPBench may return by amendment before card X3; cards B2 and BF1 |
| The injection screen on adopted records | 2026-11-21 by card E2.10's review fix pass (finding E2.10-4) | adoption records a store's items as `import` at most, the least trusted of what the record claims, what the plane holds for its id, and `import` (ADR 0007, decision D8; card RV4), and the screen's kind-conditioned rules (imperative-to-agent, standing-directive, memory-persistence, exfil-sink) never read `import`, so a record dropped into a store claiming the user's word gets only the other four rules, though a tool may have written it; whether adopted records should get those rules is a question for the lead | stated as a limit of `research/results/h1-injection-screen.json`; ADR 0039, item 5 |
| An owner's acceptance of their own imported candidates | 2026-11-22 by the lead, in card E9.8's review fix pass (finding E9.8-6) | a candidate in a person scope is promoted only by a reviewer who is a user-sourced member of that scope and neither owner nor author (ADR 0026), so a person alone cannot make their own imported memories readable; an owner's acceptance path is an ADR 0026 amendment, which would change promotion under the registered presets, so it waits until after the `prereg-v1` tag | `docs/log/2026-11-22-e9-8-finding-owner-acceptance-after-tag.md`; until then a reviewer member promotes, or the person restates a memory as a user write |

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
| GateMem deletion mechanism | under ADR 0030's mapping C5 enforces no deletion, so GateMem's active-forgetting checkpoints, half of H1's primary violation set, test nothing the plane does; choose a mechanism (model-driven ingestion with a retire tool, or a deletion lint over turns) or state F as out of scope for C5. Decided by the lead on 2026-11-19, as item 9 of `docs/research/prereg-v1-decisions.md` recommended: access control is H1's primary GateMem set and forgetting a secondary set, and no mechanism is built (`docs/log/2026-11-19-lead-decision-09-forgetting.md`; ADR 0030, amendment of 2026-11-19). The v1 plan's PR 2 measured the reachable-leak share | ADR 0030 consequences; `docs/log/2026-10-29-b3-forgetting-not-enforced.md` |
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
| Knowledge and twin team sources | the lead's part is closed: the knowledge profile's team rule admits tool and import sources, the twin profile's only user and document, and the lead confirmed on 2026-11-19 that the difference is intended (`docs/log/2026-11-19-lead-decision-team-sources.md`). Open: both profile tests repeat their load code, which a shared helper and a test that every `profiles/` file parses would replace | `docs/log/2026-11-13-e9-1-review-fixes.md` |
| Offboarding coverage | `offboard` is a core function, not a Plane method, so the invariant suite never calls it, and no surface calls it yet; a store failure's `error` text is the adapter's own and could in principle echo content | `docs/log/2026-11-13-e9-7-review.md` |
| LongMemEval split | done on branch b6 (card B6): the baseline configs read the cleaned S split at the pinned revision, checked by its sha256 (`LONGMEMEVAL_S` in `packages/bench/src/longmemeval/pinned.ts`, the hash card L2 recorded), fetched into `.engram/upstream` at the pin and never committed (277 MB); the B5 fixture subset stays the oracle file's | `docs/log/2026-11-13-b5-review.md`; `docs/log/2026-11-19-b6-baseline-configs.md` |
| Version 0 workspaces | a workspace `policy.yaml` at schema version 0 stops loading after schema version 1 and is bumped by hand; utility counting by `item_ids` rode in the schema PR as the reason its field exists; and (card RV7, RV-CORE-10, reproduced) a store record at schema version 0 is never migrated: the files adapter skips it as unreadable and the next adoption retracts the projected item, so the memory leaves every read. Upgrading such a record on read (the adapter, or adoption) is a card of its own | ADR 0002; `docs/log/2026-11-13-schema-v1-review.md`; `docs/log/2026-11-20-rv7-finding-version-zero-records.md`; `packages/adapters/test/plane/version-zero-files.test.ts` |
| File URLs in tests | nothing stops a test from building a path from `URL.pathname` again, which breaks on a checkout path with a space | `docs/log/2026-11-13-fix-test-paths-with-spaces-review.md` |
| Letta delete refusals | done on branch rv3 (card RV3, RV-ADP-5): `UnsafeLettaPathError` and `NotMemfsRepositoryError` are `NotDeletableError`s, so offboarding reports such a record under `left_in_store`; `RepositoryBusyError` stays transient (`packages/adapters/test/letta/rv3.test.ts`) | ADR 0010, post-merge amendment of 2026-11-13; ADR 0028, amendment of card RV3; `docs/log/2026-11-19-rv3-decision-letta-refusals-leave-backlog.md` |
| Deletion report surfaces | no CLI command or server route reads a deletion report's `left_in_store`, so the person is not shown which store records to delete by hand | ADR 0010, post-merge amendment of 2026-11-13 |
| ADRs for the lead | closed on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`): ADR 0018's card L1 amendment accepted (item 37); ADR 0034's two open questions answered yes, a one-year expiry cap and the whole of `grantDefect` on a first write (item 34). The lead accepted ADR 0034 on 2026-11-25 with that rule; the rule itself is not yet built (section "Decided, not yet built" below) | `docs/decisions/0018-duplicates-without-embeddings.md`; `docs/log/2026-11-19-lead-decision-adrs-accepted.md`; `docs/log/2026-11-21-answers-decision-adrs.md` |

## Follow-ups from card L3's review (2026-11-19)

Found by the review of PR #45 and left open on purpose; neither blocks card L4.

| item | what is left | where it is recorded |
|---|---|---|
| Events to members who may not read | done on branch rv7 (card RV7, RV-CORE-4): `eventVisibleTo` (packages/core/src/visible.ts) shows an event to a member of its scope only when the read matrix lets the member read that scope, and to its maker | `docs/log/2026-11-19-l3-finding-event-visible-to-unreadable-members.md`; `docs/log/2026-11-20-rv7-events-follow-the-read-matrix.md` |
| Model lints hold the write queue | `Plane.lint` keeps the write queue locked while the model answers; settle it before a server injects a lint model | `docs/log/2026-11-19-l3-finding-lint-holds-write-queue.md` |

## Follow-ups from card L2's review (2026-11-19)

Found by the review of PR #46; they need the lead or card L4, not more of L2.

| item | what is left | where it is recorded |
|---|---|---|
| Contradiction prompt and updates | decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 44): a later update of the same attribute counts as a contradiction. Left: the prompt change and its cassettes (section "Decided, not yet built" below) | `docs/log/2026-11-19-l2-review-finding-superseded-prompt.md`; `docs/log/2026-11-21-answers-decision-lints-research.md` |
| H3's deterministic claim | done: decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 45) and written into the pre-registration's H3: precision on natural memory through the audit sample, seeded recall a regression check | `docs/log/2026-11-19-l2-review-finding-h3-wording.md`; `docs/log/2026-11-21-answers-decision-lints-research.md` |
| B5's assistant model | decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 46): B5 names the model. Left: B5 writing it (section "Decided, not yet built" below) | `docs/log/2026-11-19-l2-review-finding-b5-assistant-model.md`; `docs/log/2026-11-21-answers-decision-lints-research.md` |

## Follow-ups from card L4's review (2026-11-19)

Found by the review of PR #49; they need card L2 or the lead, not more of L4.

| item | what is left | where it is recorded |
|---|---|---|
| Injected sentences' openers | the generator's injected sentences open with phrases LongMemEval's own turns lack ("For the record, my ...", "As it stands, my ...", "These days my ..."), so a model or a reader can tell injected items from base ones; card L2 decides whether the pools should drop or vary them (a generator change re-records the set, its hashes and L4's floor) | `docs/log/2026-11-19-l4-review-finding-l2-injected-openers.md` |
| H3's live lint run size | done: all 500 questions, as registered, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 47) | `docs/log/2026-11-19-l4-review-finding-live-count.md`; `docs/log/2026-11-21-answers-decision-lints-research.md` |

## Follow-ups from card B6 (2026-11-19)

Found by the work on card B6 and the review of PR #51.

| item | what is left | where it is recorded |
|---|---|---|
| LongMemEval judge in the Models section | done: the pre-registration's Models section names it, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 13) | `docs/log/2026-11-19-b6-decision-judge-route.md`; `research/configs/h2-longmemeval-c5-medium.json`; `docs/log/2026-11-21-answers-decision-gate-c.md` |
| H2 clock choice | done: the registered clock, with the descriptive sensitivity set of the 446 unaffected questions in H2's Analysis, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 12) | `docs/tasks/B6.md`; `docs/log/2026-11-19-b6-finding-clock-options-bound.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |
| Embedded Postgres teardown on Windows | vitest's embedded-Postgres teardown fails with `EBUSY` on Windows under load, which turns a `make test` whose tests all pass into exit 1; the teardown should retry or tolerate a busy folder | PR #51 review |

## Follow-ups from card E9.4 (2026-11-19)

Found by the work on card E9.4 and the review of PR #44, and left open on purpose.

| item | what is left | where it is recorded |
|---|---|---|
| In-place promotion across log handles | done by card E2.6 on branch `e2-6`, awaiting review: `Plane.promote` checks its decision under the log's lock before it appends, in place and as a new version, and refuses a stale one (`engram/promote/conflict`), putting the store back (orderings R9 and R9b of `packages/core/test/unit/plane/cross-handle.test.ts`); ADR 0007's amendment of 2026-11-19 | `docs/log/2026-11-19-e9-4-review-finding-promote-race.md` |
| Grants seen by a grantee | decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 36): a non-owner sees only the grants naming them, in core. Left: building it (section "Decided, not yet built" below) | ADR 0034, decision 9; `docs/log/2026-11-19-e9-4-review-finding-grantee-sees-all-grants.md`; `docs/log/2026-11-21-answers-decision-adrs.md` |
| Granting Claude Code's own memories | the files adapter holds a memory file Claude Code wrote read-only, so it cannot be granted; grants held by the plane alone, or a copy into an Engram item, would allow it | ADR 0034, consequences; `docs/log/2026-11-19-e9-4-finding-claude-code-memories-cannot-be-granted.md` |
| Re-adoption of plane writes | done on branch rv4 (card RV4): adoption keeps the provenance the plane holds for a record the store holds as written, so a plane write is not adopted again (`packages/adapters/test/plane/grants-files.test.ts`, `packages/adapters/test/plane/rv4-files.test.ts`) | `docs/log/2026-11-19-e9-4-finding-plane-writes-readopted-as-import.md`; `docs/log/2026-11-20-rv4-decision-backlog-rows-closed.md` |
| Offboarding's window: a grant change (V-1) | done by card E2.6 on branch `e2-6`, awaiting review: offboarding marks its erasure (`engram/offboard/begin`) before deleting store records, and a grant change in that window is refused (`engram/offboard/erasing`; ordering R2) | card E2.6; `docs/log/2026-11-19-e9-4-verification-finding-offboarding-window.md` |
| Offboarding's window: an owner's rewrite (V-2) | done by card E2.6 on branch `e2-6`, awaiting review: the rewrite's check under the lock refuses it (`engram/write/conflict`) and deletes the record it wrote (ordering R3) | card E2.6; `docs/log/2026-11-19-e9-4-verification-finding-offboarding-window.md` |
| Offboarding's window: the handover undoes a grant removal (V-3) | done by card E2.6 on branch `e2-6`, awaiting review: the stale handover is refused (`engram/offboard/conflict`), the store put back, and the item handed over as it now stands, so the removal is kept (ordering R4); the in-place promotion likewise (R9) | card E2.6; `docs/log/2026-11-19-e9-4-verification-finding-offboarding-window.md` |
| Adoption of a stale writer's bytes | done in the review fix pass of PR #50 (finding P50-1, ordering RV8): a stale writer withdraws an adoption of its own bytes (`engram/adopt/withdrawn`), and a writer whose decision stands ignores one; ADR 0007's amendment | ADR 0007's amendment of 2026-11-19 (limits); `docs/log/2026-11-19-e2-6-finding-adoption-stale-bytes.md` |
| Crashed derived writes in team and role scopes | a promotion or derived write into a team or role scope that crashes after its bytes land and after the offboarding's sweep stays in that scope's store until an adoption of the scope or a later sweep deletes it; no surface adopts a team or role scope, so in the dogfood the bytes stay dormant (never projected or read through the plane). `engram retain`, or a periodic sweep of the scopes the log names, could list them and refuse what their lineage traces to erased content | ADR 0010's amendment of verification pass 4; `docs/log/2026-11-20-e2-6-verify4-failure-v4-2-dormant-team-bytes.md` |
| The sweep's listings | the offboarding's sweep calls `adapter.list` once for each scope the log names, so its cost grows with the number of scopes, and every listing waits on the store; a store index of records by lineage, or a bound on the scopes listed, would cut it | `docs/log/2026-11-20-e2-6-verify4-failure-v4-7-sweep-listings.md` |
| Model lints across an erasure | done in the review fix pass of PR #50 (finding P50-8): `Plane.lint` drops, under the lock, every finding about or naming an item erased after its snapshot (`packages/core/test/unit/plane/cross-handle-review.test.ts`) | `docs/log/2026-11-19-e2-6-finding-lint-across-erasure.md` |
| A first write naming another owner | the write gate compares a new item's owner as written (ADR 0006), so a member of a shared scope can create an item naming another person as its owner and carrying grants, which then read as that person's consent | ADR 0034, consequences; `docs/log/2026-11-19-e9-4-verification-finding-first-write-owner.md` |

## Follow-ups from card E9.5's kit (2026-11-19)

Found while building the twin dogfood's kit; the first needs the lead, the others are cards.

| item | what is left | where it is recorded |
|---|---|---|
| Knowledge profile dogfood | decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 28): a card runs it beside the twin dogfood. Left: the card, not yet written | `docs/log/2026-11-19-e9-5-finding-knowledge-dogfood-uncovered.md`; `docs/log/2026-11-21-answers-decision-gate-d.md` |
| Adoption raises trust | done on branch rv4 (card RV4): adoption records the least trusted kind of the record's claim, the plane's item of that id and `import`, and keeps the plane's provenance for a record as written, so an agent's item stays `model` and the owner's grant on it is refused; the twin dogfood's report shows `watch.provenance_raised` 0 on its realistic log, and still counts a grant on a raised item as a violation (ADR 0004, amendment of card RV4) | `docs/log/2026-11-19-e9-5-finding-readoption-raises-model-content.md`; `docs/log/2026-11-19-e9-5-review-failure-e95-6-raised-grant-not-a-violation.md`; `docs/log/2026-11-20-rv4-decision-backlog-rows-closed.md` |
| Promotion carries grants | done: ADR 0034 amended on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 35): an owner's promotion keeps the grant, which then admits nothing across a class change; a promotion by anyone else carries none (card RV7) | `docs/log/2026-11-19-e9-5-review-finding-promotion-carries-grants.md`; `docs/log/2026-11-21-answers-decision-adrs.md` |
| An event's actor capacity | an event records the actor's id only, not its level, memberships or source, so the violation report judges reads under the flags a member declares and cannot check the source of an `engram/grant/change` event; recording them is a schema change (AGENTS.md rule 5) | `docs/log/2026-11-19-e9-5-decision-declared-actors.md` |
| The report on a Postgres log | `packages/core/scripts/dogfood-report.ts` reads a SQLite log only | `docs/log/2026-11-19-e9-5-decision-default-sqlite-log.md` |

## Follow-ups from card RV3 (2026-11-19)

Found by the repository review of the adapters and by the work on card RV3; card RV3 fixed RV-ADP-1, 2, 3, 5, 7, 8, 9 and 10.

| item | what is left | where it is recorded |
|---|---|---|
| Adoption carries grants from a dropped file (RV-ADP-4) | done on branch rv4 (card RV4): adoption keeps a grant only when the plane's item of that id carries it, drops any other and names it in the reason; the forge probe's file adopts without its grant to Mallory, and the owner's grant change through the plane keeps its grants (ADR 0034, amendment of card RV4) | `docs/log/2026-11-19-rv3-finding-adp4-adoption-carries-grants.md`; `docs/log/2026-11-20-rv4-decision-backlog-rows-closed.md` |
| What `search` means across stores (RV-ADP-6) | decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 41; ADR 0013's amendment of 2026-11-21): any query term, ranked by core, on every store. Left: the adapters and the conformance suite (section "Decided, not yet built" below) | `docs/log/2026-11-19-rv3-finding-adp6-search-across-stores.md`; `docs/log/2026-11-21-answers-decision-adrs.md` |
| Adoption after a folder move | done on branch rv4 (card RV4): a projected item of the same store and scope at a ref the store now lists another id under, which the listing no longer holds, is retired in the transaction that adopts the record now there; erased content stays refused in its scope under any id, and an item retired by anything but adoption is not brought back under its new id (`engram/adopt/rekeyed`) (ADR 0007, 0010 and 0013, amendments of card RV4) | ADR 0013, amendment of card RV3; `packages/adapters/test/plane/rv3-files.test.ts`; `docs/log/2026-11-19-rv3-review-failure-rv3-1-folder-move.md`; `docs/log/2026-11-20-rv4-decision-backlog-rows-closed.md` |
| One log, two files folders | core keys a ref by adapter name and file name, and every surface names the files store `files`, so a second folder adopted into the same log is refused; a surface flag for the adapter name, or refs that name the folder, would allow it | `docs/log/2026-11-19-rv3-finding-one-log-two-folders.md` |
| Retired titles in Letta's index | the Letta adapter's `engram/MEMORY.md` keeps a line with the title of every item, retired ones included, which an agent opening the index reads; drop the title, or the line of a retired item | ADR 0028, amendment of card RV3; `docs/log/2026-11-19-rv3-finding-letta-index-keeps-retired-titles.md` |

## Follow-ups from card RV1 (2026-11-19)

Built by card RV1 (the repository review's RV-EXP-1 to -5 and -10) with proposed values; each needs the lead before the tag.

| item | what is left | where it is recorded |
|---|---|---|
| Turn limit | done: 8 model calls in every experiment config of the runner, a capped session excluded and counted per condition, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 4) and written into the pre-registration | `docs/log/2026-11-19-rv1-decision-turn-limit-default.md`; `docs/log/2026-11-19-rv1-decision-turn-limit-not-keyed.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |
| Spend ceiling | done for the runner's four experiment configs: 1.25 times each run's high estimate, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 3), `research/tests/test_run_limits.py`. Left: the lint configs, whose schema takes no ceiling (section "Decided, not yet built" below) | `docs/log/2026-11-19-rv1-decision-spend-ceiling-default.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |
| Deterministic answer failure | decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 14): such a session is excluded under its own reason, counted per condition. Left: the runner recording it (section "Decided, not yet built" below) | `docs/log/2026-11-19-rv1-finding-answer-400-stops.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |
| Concurrent writers | done by card RV6: a run journal holds `run.lock` in its folder and a second writer is refused | `docs/log/2026-11-19-rv1-finding-concurrent-writers.md`; `docs/log/2026-11-20-rv6-run-lock.md` |
| Capped utility sessions | decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 15): the H1 table counts them per condition. Left: the count in `research/analysis/h1.py` (section "Decided, not yet built" below) | `docs/log/2026-11-19-rv1-review-failure-4-utility-gap.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |
| v1's condition wording | done: card RV1's wording for C3, C4 and the ids is in the pre-registration's Conditions, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 16) | `docs/log/2026-11-19-rv1-finding-v1-condition-wording.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |

## Follow-ups from card RV5 (2026-11-20)

From the repository review of the surfaces (findings RV-SRF-1 to RV-SRF-9); each waits on the lead.

| item | what is left | where it is recorded |
|---|---|---|
| Claude Code's native memory path | done: members turn auto memory off, and "zero violations" is measured on the plane with the native path stated as outside it, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 33). `docs/dogfood.md` still words it as the lead's decision (section "Decided, not yet built") | `docs/log/2026-11-20-rv5-finding-native-memory-path.md`; `docs/dogfood.md`, limits 7 and the auto memory section; `docs/log/2026-11-21-answers-decision-gate-d.md` |
| What `at` means over HTTP | done: this design accepted, the server and core own the access clock, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 19; ADRs 0005 and 0027, while ADR 0025's RV5 amendment stays proposed) | ADR 0027, amendment proposed by RV5; `docs/log/2026-11-21-answers-decision-adrs.md` |
| The owner is self-asserted | a caller claiming the store owner's id is the owner to `syncBeforeRead`, as to every route, until authentication | ADR 0025 and ADR 0027, amendments proposed by RV5 |
| A person's restatement of retired agent content | adoption's kind floor (card RV4, fix pass 2) refuses a person's own new file that repeats an agent item already retired, even one retired by its ttl; exempt ttl retirements or accept the cost | ADR 0004, amendment proposed by RV4 |
| Denied store hits in a capped search | a store hit whose record diverged from the projection is dropped and matched over the projection, but still takes one of a capped store's hits (Mem0, 20) | ADR 0004, amendment proposed by RV4 |

## Follow-ups from card RV6 (2026-11-20)

Built by card RV6 (the design review's RV-DES-9, -10 and -11); each needs the lead, or a card, before the tag.

| item | what is left | where it is recorded |
|---|---|---|
| OpenRouter upstreams | decided (the review cards' table, on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`)): each model and judge on its maker's own endpoint where OpenRouter lists one, else the cheapest that honours `seed`, `allow_fallbacks: false`. Left: naming the endpoints in each config (section "Decided, not yet built" below) | `docs/log/2026-11-20-rv6-openrouter-upstream.md`; `docs/log/2026-11-20-rv6-finding-pi-ai-openrouter-routing.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |
| The B1 tolerance | accepted as computed (U 40 to 50, A 0 to 12, F 0 to 6 of 50; the review cards' table, on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`)). Left: the small card that adds the script computing the three rates (Eqs. 10 to 12) from the run | `docs/log/2026-11-20-rv6-review-decision-b1-two-sample-band.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |
| The smoke run's pass rule | done: accepted as proposed (the review cards' table, on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`)) and written into the pre-registration's H1 | `docs/log/2026-11-20-rv6-decision-smoke-subset.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |
| B1's sampling | the runner's C1 sends no temperature, while upstream's reference agent runs at 0.2; a C1 temperature (a C1 cache key change) or a live path for the B1 harness would match it | `docs/log/2026-11-20-rv6-finding-b1-sampling.md` |
| Shard count and ceilings | done: 4 shards for H1 and each arm's ceiling the whole run's (the review cards' table and item 3, on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`)) | `docs/log/2026-11-20-rv6-finding-h1-wall-time.md`; `docs/log/2026-11-20-rv6-decision-shard-ceiling.md`; `docs/log/2026-11-21-answers-decision-gate-c.md` |

## Follow-ups from card RV7 (2026-11-20)

From the core review (RV-CORE-1 to 10); each needs the lead.

| item | what is left | where it is recorded |
|---|---|---|
| Confidence the model chooses | done: ADR 0007 records that the floor does not gate model and compaction sources, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 42) | `docs/log/2026-11-20-rv7-finding-confidence-floor-gates-a-claim.md`; `docs/log/2026-11-21-answers-decision-adrs.md` |
| Owner rules, the stricter readings | done: card RV7's rules accepted and the stricter readings not taken, decided on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 39 and the review cards' table, row RV7) | `docs/log/2026-11-20-rv7-only-the-owner-moves.md`; `docs/log/2026-11-20-rv7-decision-owners-agent-keeps-rewrite.md`; `docs/log/2026-11-21-answers-decision-adrs.md` |
| Walks with no path | the shell check does not judge `find`, `rg x` or `grep -r x` with no path from the folder holding a root (ADR 0014's RV7 amendment) | `docs/log/2026-11-20-rv7-decision-walks-no-implicit-cwd.md` |
| A grant over text the owner never saw | `Plane.changeGrants` takes no expected version or content hash, so the owner may grant an item a co-holder rewrote before it carried any grant (review finding RV7-R6 of PR #61); an expected version on the call, refused when the item moved on, would close it | `docs/log/2026-11-20-rv7-review-finding-grant-without-expected-version.md`; ADR 0034, RV7 amendment |
| A promotion out of the owner's reach | a reviewed promotion by a co-holder into a scope the owner is not a member of retires the source and leaves the owner reading nothing; since the review fix pass of PR #61 it carries no grant, but the owner still loses the item (ADR 0026's widening) | `docs/log/2026-11-20-rv7-review-decision-promotion-drops-grants.md`; ADR 0006, RV7 amendment |
| First-write forgery | named by the review of PR #61 (RV7-R9) as an ADR 0034 limit, not a regression of card RV7: the row "A first write naming another owner" above holds it | `docs/log/2026-11-19-e9-4-verification-finding-first-write-owner.md` |

## Follow-ups from card RV8 (2026-11-21)

From the review fix pass of PR #65; each needs the lead.

| item | what is left | where it is recorded |
|---|---|---|
| LongMemEval's audit allocation | the pre-registration registers no sampling rule for LongMemEval's audit, and a uniform draw of 50 holds few abstention questions; the recommendation is a stratified draw with at least 5 abstention items, registered before the audit of 23 to 28 November (one function in `label_audit_sample.py` and its seed) | `docs/log/2026-11-21-rv8-review-finding-lme-audit-stratified.md` |
| The frontier axis to register | ttl at 7 days and budget 50 each move both benchmarks at non-degenerate values (item 21); the lead chooses which axes are registered by amendment before X6 | `docs/log/2026-11-21-rv8-review-finding-axes-quantified.md` |

## Follow-ups from the absorb plan (2026-11-21)

From `docs/tasks/absorb-plan.md` and the PR that merged it into the roadmap.

| item | what is left | where it is recorded |
|---|---|---|
| The register's check | planned in `docs/tasks/absorb-plan-2.md` as card E0.6; `make lint-docs` does not yet fail when `docs/absorbed.md` names a missing file (ADR 0037, decision 8); the first card that adds a row builds it | `docs/decisions/0037-absorbing-open-source.md` |
| The 136 plans not selected | thirty more selected on 2026-11-25 (`docs/tasks/absorb-plan-2.md`, crypto-shredded erasure among them), the rest still candidates as that plan's section 7 says; candidates, not commitments: crypto-shredded erasure and the encrypted person scope first, then derived-from edges, the approval workflow, dense retrieval as a registered proposal, ingestion after Gate D | `docs/research/absorb/long-list.md`; `docs/tasks/absorb-plan.md`, section 7 |
| Stale status lines | several merged cards still say "awaiting review" in their `Status:` line (for example L2, L3, L4, E9.4, E9.5); one housekeeping PR sets each to its merge | `docs/tasks/` |
| The answers card before R2 | done by the answers card on branch `answers-2026-11-21` (its PR); card R2 may start | `docs/tasks/lead-decisions.md`; `docs/tasks/R2.md`; `docs/log/2026-11-21-answers-change-prereg.md` |
| Surfaces with no attested source | done on branch e2-7-trust-counterexamples (card E2.7): every surface listed with file and line; HTTP clients and library callers are the open paths | `docs/log/2026-11-21-orch-finding-unattested-provenance-by-design.md`; `docs/log/2026-11-21-e2-7-finding-gh-39-surfaces.md` |
| Sources for C6 and C7 | neither condition is built (`packages/runner/src/config.ts`); the cards that add them (X10 for C6; for C7, if it is still built after item 25 of `docs/tasks/lead-decisions.md`, the MCP path of ADR 0022) must give every actor that writes, promotes or sweeps a harness-set source, or GH-39 (a sourceless write keeps its claimed kind, in the write gate, promotion and the retired-content rule) becomes reachable from a registered condition | `docs/log/2026-11-21-e2-7-finding-gh-39-promotion-and-relearning.md` |

## Follow-ups from card R4 (2026-11-21)

Claims the crosswalk (`docs/compliance/README.md`) marks not evidenced, and what the crosswalk itself leaves open. Building any of them is out of R4's scope (`docs/log/2026-11-21-r4-decision-backlog-rows.md`).

| item | what is left | where it is recorded |
|---|---|---|
| Crosswalk C30: reinstatement | a feature to build before any test: ADR 0010 and ADR 0025 (decision 6) say a retired item can be reinstated by an allowed update event, but no Plane method or surface reinstates one, so there is nothing yet for a test to exercise; the follow-up card ADR 0025 names builds the surface, then its test | `research/configs/crosswalk.json`, claim C30 |
| Crosswalk C44: injected time | planned in `docs/tasks/absorb-plan-2.md` as card E0.7; the claim as first written (nothing in packages/core reads the clock) is false: the Postgres transport calls `Date.now()` for its timeouts (`packages/core/src/db/postgres-worker.ts` lines 34, 41, 54; `postgres.ts` lines 211, 229). Restated, decision and event times are injected and only the transport reads the clock; no test or lint rule shows it. A lint rule refusing clock and randomness calls in packages/core outside `src/db/postgres*.ts` (as `scripts/test/pi-import-rule.test.ts` does for pi imports) would evidence it | `research/configs/crosswalk.json`, claim C44; `docs/conventions/testing.md` (correction) |
| Crosswalk C48: procedure drift | planned in `docs/tasks/absorb-plan-2.md` as card D4; not built: the smoothed success rate is a later schema change (ADR 0011, D4) and retirement on drift, a changed environment hash or a human rejection waits for card D3; the claim gets its test with that card | `research/configs/crosswalk.json`, claim C48 |
| Crosswalk C50: Gate D's dogfood | the twin dogfood's two weeks wait for the lead's go (`docs/dogfood.md`), no member report is committed, and no card covers the Knowledge profile's dogfood (backlog row "Knowledge profile dogfood"); the claim is evidenced by the committed reports, not by a test | `research/configs/crosswalk.json`, claim C50 |
| A results glob outside the hypotheses | `research/tests/test_prereg.py` maps every MANIFEST row to one hypothesis's results glob, so the crosswalk, which tests no hypothesis, is filed as `research/results/h1-crosswalk.json`; a pre-registration amendment adding a glob for results outside H1 to H5 (and renaming the file) is card R2's or the answers card's to propose | `docs/log/2026-11-21-r4-decision-result-under-h1.md` |

## Follow-ups from card E1.4 (2026-11-21)

| item | what is left | where it is recorded |
|---|---|---|
| Grants on laundered agent content (finding E14-F3) | planned in `docs/tasks/absorb-plan-2.md` as card E2.15; a core card: refuse adding or widening a grant (in a write, a grant change or a promotion's new version) on an item any allowed version of which, or of the source it was promoted from, held untrusted content; today Dana re-saving her agent's identical text as a user-sourced write makes the item `user`, a grant to Sam is allowed and Sam reads the agent's words verbatim, which ADR 0021's decision D4 and its RV4 amendment forbid and the oracle counts as a violation; also, any rewrite of an agent item by the person raises its provenance and makes the dogfood report's `watch.provenance_raised` non-zero, so `docs/dogfood.md` (limit 4 and the `watch` row), which says it should stay 0, needs correcting with that card | `docs/log/2026-11-21-e1-4-review-finding-e14-f3-laundering.md`; `packages/core/test/property/stateful.test.ts` (E14-F3) |

## Follow-ups from card B7 (2026-11-21)

| item | what is left | where it is recorded |
|---|---|---|
| MERIT C1's cost (card X7) | MERIT's C1 is FullReplay, so its prompts grow with each arc toward the 60,000-character cap (about 15,000 tokens per call at the cap, several calls per episode); budget C1's spend before the live run, from the fixture slice's call shapes and MERIT's own reference runs' token counts | ADR 0031's amendment of 2026-11-21; `docs/log/2026-11-21-b7-decision-c1-adr-0031.md` |
## Follow-ups from card E1.5 (2026-11-21)

Two gaps in the commit and erasure protocol that the Quint model found (`specs/README.md`, "What the model found"). Card E1.5 changes nothing under `packages/`, so each is pinned by a scenario test that fails once the code and the model are fixed, and left to a core card.

| item | what is left | where it is recorded |
|---|---|---|
| The sweep's put-back leaves erased content | planned in `docs/tasks/absorb-plan-2.md` as card E1.7; `offboard.ts` `run`, the put-back loop after a changed swept record: when its read finds the item gone (a third offboarding of the person erased it between the put-back's read and its write) it ends with `break` and leaves the bytes it wrote; it should delete the record when the item is gone or its scope is being erased, as `commit.ts` `settle`'s `wanted` does, then change `obPutBackRead` in the model to match and turn `knownGapThreeOffboardings::putBackAcrossThirdErasureTest` into a passing test of the fix | `docs/log/2026-11-21-e1-5-finding-put-back-leak.md` |
| Adoption's purge deletes a committed write's record | planned in `docs/tasks/absorb-plan-2.md` as card E1.7; two paths delete a refused record outside the lock with nothing checked after the refusal: `adopt.ts` `purgeOutcome` after a fresh refusal, and the purge retry for bytes already refused (`adopt.ts`, the `decided` branch of `adoptStoreItems`), which runs with no lock and no deferral; a write under a swept id (allowed, since `write.ts` `planeRefusal` checks `lastErasure` only) that commits in between loses its record, and the next adoption retires it. Fix one or both: refuse a new write under a swept id as under an erased one, and check under the lock, just before each purge's delete, that the item has not changed since the refusal; then turn `good::sweptIdPurgeRaceTest` into a test of the fix | `docs/log/2026-11-21-e1-5-finding-purge-race-on-the-code.md` |

## Decided, not yet built (the answers card, 2026-11-21)

Each row is an answer of 2026-11-20 (`docs/tasks/lead-decisions.md`) that the answers card carried into the documents but that needs code, a card, a result regenerated, or the lead. Each is recorded in `docs/log/2026-11-21-answers-finding-decided-not-built.md` unless it names its own entry.

| item | what is left | where it is recorded |
|---|---|---|
| ADR 0034's cap and first-write rule | item 34: a grant's expiry capped at one year, and a first write held to the whole of `grantDefect` (an expired grant or one of another class refused); the fixtures that write such grants fixed in the same card. ADR 0034 was accepted by the lead on 2026-11-25 with this rule in its decisions 3 and 6, which fix the year as 365 days (31,536,000 seconds) from the write's event time, a longer expiry refused under `engram/write/grant-expiry-cap`, the cap and the expiry check on every grant of a first write and every grant a grant change adds, on `Plane.write` and `Plane.changeGrants` alike (kept grants not judged again), and a promotion's new version exempt; card E2.21 builds it, changing the two `write-grants.test.ts` tests that pin today's behaviour; the code does not enforce it yet (`grantDefect` has no expiry cap; `evaluateWrite` judges a first write's grants by the gate's grant rule and the duplicate check only) | ADR 0034, amendment of 2026-11-21 and acceptance of 2026-11-25; `docs/log/2026-11-25-ans-2026-11-25-finding-adr-0034-cap-not-built.md` |
| Grants a non-owner sees | item 36: the read path returns to a non-owner only the grants that name them, in core | ADR 0034, decision 9 and amendment of 2026-11-21 |
| Offboarding's answers | item 38: an offboarded person scope refuses later writes and adoptions; erased content's hashes kept for deleted records too; a Claude Code file holding erased content refused even after it is appended to | ADR 0010, amendment of 2026-11-21 |
| Any-term search on every store | item 41: the files and Letta adapters match any term, the Mem0 adapter's semantic search no longer decides a hit, and the conformance suite holds it | ADR 0013, amendment of 2026-11-21 |
| The contradiction prompt's change | item 44: the prompt and its cassettes; it moves the prompt characters `research/results/h3-lint-floor.json` and `research/results/h2-cost-table.json` record and the cassettes of `fixtures/cassettes/l3-lint-fixture`, so it is its own PR with those regenerated | ADR 0008, amendment of 2026-11-21 |
| B5 names its assistant model | item 46: B5's assistant turns carry a model (the fault set's `longmemeval/assistant`); it changes B5's events and cassette keys, so B5's and B6's fixture cassettes are recorded again | pre-registration, H3 |
| A refused answer call | item 14: the runner records a non-retryable refusal of an answer call as an exclusion under its own reason, counted per condition, before the tag; an HTTP 401, 402 or 403 from the provider (a key or credit problem) stops the run instead, never a per-session exclusion (the coordinator's decision of 2026-11-21) | pre-registration, pre-tag condition 3; `docs/log/2026-11-21-answers-decision-cap-in-billed-dollars.md` |
| Capped utility sessions in the H1 table | item 15: a per-condition count in `research/analysis/h1.py` and its schema, before the tag | pre-registration, Statistics and H1 |
| The audit configs' response | done (card R5): item 6: `on_stop` set to `drop` in `research/configs/label-audit.json` and `label-audit-longmemeval.json`; both draw records hold the value, so `research/results/h1-label-audit.json` and `research/results/h2-label-audit-longmemeval.json` are regenerated (their draws unchanged) in that PR, before the agreement is computed | `docs/log/2026-11-21-answers-finding-on-stop-moves-results.md` |
| OpenRouter endpoints in the configs | the review cards' table, row RV6: `openrouter_provider.answer` and `.judge` in each live config, named from OpenRouter's endpoint list, which this card could not read offline | pre-registration, Models |
| Ceilings for the lint runs | item 3: `l3-pilot.json` and `h3-lint-model.json` take no `spend_ceiling_usd` (their schemas are strict and have no such field); by the formula, in ledger dollars at pi-ai's catalogue price, they would be 0.06 and 113.90 dollars on M1 | `research/results/h2-cost-table.json`; `docs/log/2026-11-21-answers-decision-ceilings-in-ledger-dollars.md` |
| M2's reasoning | done: the lead kept GLM 5.3 Flash and amended v1's Models rule on 2026-11-21: a model that cannot switch reasoning off runs at its provider's default effort, on a pinned endpoint, its reasoning tokens metered, and the report states this (lead-decisions item 57); its cost estimated with the reasoning allowance was added under the delegation, and its reasoning tokens are recorded on their own by the row "Reasoning tokens in the ledger" | `docs/log/2026-11-21-answers-finding-m2-reasoning-off.md`; `docs/log/2026-11-21-answers-decision-lead-m2-reasoning.md` |
| The smoke run's price and commands | item 1: `research/configs/h1-check-runs-cost.json` prices the smoke run on `gpt-5.6-terra`, and repricing it on M1 regenerates `research/results/h1-check-runs-cost.json`; section 7 of `docs/tasks/prereg-v1-plan.md` still names that model in its live commands | `docs/log/2026-11-21-answers-finding-decided-not-built.md` |
| Documents outside the answers card | `docs/dogfood.md` (its second precondition is met, auto memory off is decided, the Knowledge dogfood has an answer), the status lines of cards E9.5, X2 and X3 (items 1 and 20 answered), and card B9's scope (ADR 0035) still read as before the answers | `docs/log/2026-11-21-answers-finding-decided-not-built.md` |
| Drafts owed to the lead | item 26: the kill list's rewrite, proposed in `docs/roadmap.md`, waits for the lead's approval; item 30: H5's prerequisites (the tau2 split, the user-simulator model, the repository task set dropped, the harness card) are not drafted, and item 9 fixes them before H1's data exist | `docs/roadmap.md`, kill list |
| The request-identity check | item 20 and ADR 0035, decision 1: a card builds the check, a rule-9 result with its MANIFEST row, with the files store in the runner; no card file exists for it yet | ADR 0035 |
| A ledger metered from OpenRouter's cost | the runner prices each call at pi-ai 1.3.0's catalogue (`calculateCost` over `model.cost`), half of OpenRouter's list price for M1, so a ceiling bounds real spend only through the price ratio v1's Models section gives; a runner card that records the cost OpenRouter reports for each call as the ledger's would let `spend_ceiling_usd` bound real spend directly | `docs/log/2026-11-21-answers-decision-ceilings-in-ledger-dollars.md` |
| The programme-wide spend cap | item 59, the lead's answer of 2026-11-21, with the unit and enforcement added under the delegation: a card before 1 December has the runner check before each session the real spend across every run, in billed dollars: each paid call's ledger cost converted by its model's list-to-catalogue ratio, input and output apart, from the ratios `research/tests/test_run_limits.py` records; a model with no recorded ratio refuses to run under the cap; the cap (the API credit held) read from a config or the environment; a run that would cross it pauses for the lead. Until it lands, the operator reads OpenRouter's credit balance at least every two hours while any shard runs and stops every shard when the credit left falls below one session's cost per running shard plus 10 percent (pre-registration, pre-tag condition 7) | `docs/log/2026-11-21-answers-decision-lead-spend-cap-as-answered.md`; `docs/log/2026-11-21-answers-decision-cap-in-billed-dollars.md` |
| GateMem's judge id | closed: the judges stay as registered (lead-decisions item 1), so `openrouter/openai/gpt-4o` is kept and its undated alias is stated as a limitation in v1's Models section; the per-call record of the resolved model is the row below | `docs/log/2026-11-21-answers-decision-judge-alias-kept.md` |
| The audit's rejected items in the H1 table | when a benchmark's stop trips, its rejected items are dropped from the analysis (item 6), and `research/configs/h1-table.json` and `research/scripts/h1_table.py` take no list of dropped items yet; below the stop they are kept and listed. The PR that writes the audit into v1 adds the input if a stop trips (pre-registration, pre-tag condition 1) | `docs/log/2026-11-21-answers-decision-rejected-items-kept-below-the-stop.md` |
| The resolved model of each call | the ledger (`UsageRecord` in `packages/model/src/cached.ts`) records the upstream that served a call but not the model version OpenRouter resolved its id to, which matters for GateMem's undated judge alias `openrouter/openai/gpt-4o`; a runner card records it per call in the ledger and the run's report | `docs/log/2026-11-21-answers-decision-judge-alias-kept.md` |
| Reasoning tokens in the ledger | `UsageRecord` counts reasoning tokens inside `output_tokens` and has no field for them, so M2's reasoning (lead-decisions item 57) is priced but not reported on its own; a card adds `reasoning_tokens` before M2's first run, after Gate C. Not a pre-tag item | `docs/log/2026-11-21-answers-decision-lead-m2-reasoning-as-answered.md` |

## Follow-ups from card D1 (2026-11-21)

| item | what is left | where it is recorded |
|---|---|---|
| Recorder holds leave no event | a session the recorder holds (an identifier still matches the secret table after the scrub) is reported to the caller only; the log records nothing, because no Plane method takes a refusal without an item. It needs a method such as `Plane.recordHold(actor, { source, fields }, at)`, one deny event naming the field paths and never their values, or card E2.9's write-gate guard deciding the write itself | `docs/log/2026-11-21-d1-decision-hold-identifiers.md`; `packages/runner/src/recorder.ts` |
| Recorder: external content in sessions | an episode is `model` or `compaction`, but a session holding content fetched from the web would be `external` under ADR 0004's least-trusted rule; nothing in a pi session marks such content, so the recorder cannot see it. A harness that labels fetched tool results (an `engram.origin` custom entry, or a tool allowlist) would let the recorder set `external` | `docs/log/2026-11-21-d1-review-decision-source.md`; ADR 0004 |
| Secret-name over-match | planned in `docs/tasks/absorb-plan-2.md` as card E2.16; the bypass table's name rule (`SECRET_NAME` in `packages/core/src/plane/bypass.ts`, before card D1) takes any name holding KEY, TOKEN, AUTH and the like, so `max_tokens=100`, `keyword=x` and `MONKEY=y` lose their values in bypass reasons, and `isSecretName` inherits it for the recorder's scrub; a word-based name rule (a name's words, not its substrings) would fix both, and changes bypass reasons, so it is card E2.9's | `packages/core/test/unit/plane/bypass-corpus.test.ts` (the `max_tokens` row); `docs/log/2026-11-21-d1-verify-decision-secret-arguments.md` |
| Recording policy: the content guard | the recorder's scrub is a best-effort pre-filter (`packages/core/src/distill/scrub.ts`, its header lists what it does not cover); once card E2.9 merges, the policy the recorder writes under should set `content_guards.secrets: block`, so the guaranteed guard judges every `Plane.write` the recorder makes; no registered preset sets it, and none may before the pre-registration allows | `docs/log/2026-11-21-d1-final-decision-scrub-scope.md`; `packages/core/src/schema.ts` (`content_guards`, card E2.8) |
| Plane.distill and the /distill route | 2026-11-22 by card D2's review fix pass (finding D2-10) | card D2 built the induction as a `Distiller` (`createAwmDistiller`, `packages/core/src/distill/induce.ts`) and the runner writes its candidates through `Plane.write`; `Plane.distill(sessions, method)` has no actor, time or model to run it with, so it still throws `NotImplementedYet` naming `backlog`, and the server's `/distill` answers 501; wiring it needs those in its signature (a change to the HTTP contract, then `make api`) and the lead's change to the invariants file, which classifies the method as unimplemented | `docs/log/2026-11-21-d2-decision-plane-distill.md`; `packages/core/test/property/invariants.test.ts` |

## Follow-ups from card E2.9 (2026-11-21)

| item | what is left | where it is recorded |
|---|---|---|
| Guard scans `content` only | planned in `docs/tasks/absorb-plan-2.md` as card E2.16; a credential written into `provenance.ref` (or another item field) is never scanned by the content guards; scanning `provenance.ref` too would need its own reason wording, since a ref is shown to readers | `docs/log/2026-11-21-e2-9-change-review-fix-pass.md`; `research/configs/secret-guard.json` (limits) |
| Unkeyed hash in adoption deny events | planned in `docs/tasks/absorb-plan-2.md` as card E2.16; an adoption deny event records the plain sha256 of the store item it refused, so a short secret could be confirmed by hashing guesses against the log; low risk, a keyed hash is the fix (ADR 0039, decision 4, leaves a keyed hash as a later decision) | `docs/log/2026-11-21-e2-9-change-review-fix-pass.md` |
## Follow-ups from card X15 (2026-11-21)
What card X15's measurement of the plane's latency found and left unoptimised (out of its scope: no change before the `prereg-v1` tag).
| The plane's whole-table scans | every Plane.write, denied ones included, reads and parses the whole item projection (`retiredContent`, `packages/core/src/plane/write.ts`); an allowed write reads it twice more (`enforceBudget` and `retentionUsage`, `packages/core/src/plane/retention.ts`); a read reads it twice (`currentItems`, `packages/core/src/plane/read.ts`) and hashes every reachable item three times with `strictContentHash`; so each call's time grows with the store although its statement count does not. A scoped query per call helps the writes; it does not help a read by a member of every scope, which needs the hashing and the second projection read reduced instead. Card X15 measured it and left it unoptimised | `docs/log/2026-11-21-x15-finding-whole-table-scans.md`; `research/results/h2-perf-budget.json` |
| `retentionUsage` reads every read event | every allowed write's budget check (`enforceBudget`, then `retentionUsage` in `packages/core/src/plane/retention.ts`) selects every read event in the log and parses its body to count how often each item was returned, so an allowed write's cost grows with the read history without bound, whatever the store's size: a production scaling problem, not only a benchmark one. A count kept per item as reads append (a schema change, rule 5) or a bound on the window counted would fix it; `packages/core/test/bench/count.test.ts` pins today's behaviour under finding X15-2 | `docs/log/2026-11-21-x15-finding-whole-table-scans.md` |
| A new Db handle scans the whole log | the first read time check on a handle (`logHead` in `packages/core/src/plane/read.ts`) reads and parses every event, so each in-process `engram` command pays one scan of the log at its first plane call | `docs/log/2026-11-21-x15-finding-cold-handle-log-scan.md` |

## Follow-ups from the README overhaul (2026-11-21)

| item | what is left | where it is recorded |
|---|---|---|
| Stale `ContentGuards` comment in the schema | planned in `docs/tasks/absorb-plan-2.md` as card E2.14; the doc comment above `ContentGuards` in `packages/core/src/schema.ts` still says the block is "enforced by nothing yet" and that the loader refuses any value but `off` until E2.9 and E2.10 land; both have merged, so the comment is wrong. It is in the schema file, which rule 5 keeps to its own PR, so a documentation PR leaves it; the next schema PR corrects the comment | `docs/log/2026-11-21-readme-change-review-fix-pass.md` |
| Handles outside the shared opener keep no hash chain | planned in `docs/tasks/absorb-plan-2.md` as card E1.9; since the review fix pass of card E1.6 (E1.6-1) the shared opener `openWorkspace().open()` keeps the chain for the CLI, serve, mcp, the hook and the pi package; a handle opened any other way (the runner's and the bench's scratch logs, a library caller of `workspaceOf`) keeps none, so an event it appends to a chained log verifies FAILED at the anchor; by design for research runs, whose logs are never verified | `docs/log/2026-11-21-e1-6-review-change-shared-opener.md` |
| Attestations in the chain | planned in `docs/tasks/absorb-plan-2.md` as card E1.9; card E8.12's `event_attestations` rows (migration 6, on main) are outside the hash chain: an edited attestation verifies clean today (`packages/core/test/unit/log/chain.test.ts` asserts it); each event's attestation digest should join its chain record, in the same transaction | `docs/log/2026-11-21-e1-6-review-decision-attestations-on-main.md` |
| Concurrent first migration | planned in `docs/tasks/absorb-plan-2.md` as card E1.9; two processes creating a fresh log at once can fail with "table events already exists": `migrate` (packages/core/src/db/migrate.ts) reads `schema_migrations` outside the transaction that applies each migration, so both see it pending; re-reading it inside the transaction, and skipping a migration another process applied, fixes it; predates card E1.6 | `docs/log/2026-11-21-e1-6-verify-finding-migrate-race.md` |

## Follow-ups from the second absorb plan (2026-11-25)

Found while selecting `docs/tasks/absorb-plan-2.md`. None is absorb work, so the plan names them and does not own them.

| item | what is left | where it is recorded |
|---|---|---|
| Gate work with no card | done: the gate-work cards pull request (2026-11-25, fixed 2026-11-26) gives each item a card: R5 (condition 2), X21 and X20 (condition 3), R6 (condition 5), X22 (condition 7's runner half, after H1; H1 is capped by the operator's credit check), X23 (the request-identity check), E9.17 (the Knowledge dogfood), L10 (the contradiction prompt). Left: H5's prerequisites (lead-decisions item 30), drafted apart as a proposed amendment (the lead's answer to Q4 of 2026-11-25) | `docs/log/2026-11-25-ap2-finding-gate-work-unowned.md`; `docs/log/2026-11-25-gw-milestone-cards.md` |
| Schema version bumps after the tag | the policy shares `SCHEMA_VERSION` with items and events, and C3 and C4 embed it, so any bump moves H1's cassette keys and H3's pinned fault-set hashes; an ADR separating the policy's version from the item and event version would free the plans the second absorb plan left out for this reason | `docs/log/2026-11-25-ap2-finding-schema-bump-after-tag.md` |
