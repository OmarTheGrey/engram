# Backlog

Work the lead has deliberately set aside. Nothing here blocks a card unless the card says so; taking an item off the backlog is a `decision` log entry.

| item | backlogged | what is left | where it stands |
|---|---|---|---|
| MPBench | 2026-10-22 by the lead; the request leaves the backlog by plan decision 6 (2026-10-29) | the request in `docs/research/mpbench-request.md` is not sent; the lead left that default standing on 2026-11-19 (`docs/log/2026-11-19-lead-decision-mpbench-not-sent.md`), and MPBench stays a candidate in `packages/bench/PINS.md`; the poisoning arm was chosen on 2026-10-29: MEM-INV-Bench (ADR 0029, Gate A exception (b)) | no release (S0.6); MEM-INV-Bench released, checked and recorded as a candidate (2026-10-29), then pinned in `packages/bench/PINS.md` and registered for H1 by the pre-registration's v1 draft, with MPBench moved to the candidates table (2026-11-03, plan decision 8; decision sheet item 15 of `docs/research/prereg-v1-decisions.md`); MPBench may return by amendment before card X3; cards B2 and BF1 |

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
| Version 0 workspaces | a workspace `policy.yaml` at schema version 0 stops loading after schema version 1 and is bumped by hand; utility counting by `item_ids` rode in the schema PR as the reason its field exists | ADR 0002; `docs/log/2026-11-13-schema-v1-review.md` |
| File URLs in tests | nothing stops a test from building a path from `URL.pathname` again, which breaks on a checkout path with a space | `docs/log/2026-11-13-fix-test-paths-with-spaces-review.md` |
| Letta delete refusals | done on branch rv3 (card RV3, RV-ADP-5): `UnsafeLettaPathError` and `NotMemfsRepositoryError` are `NotDeletableError`s, so offboarding reports such a record under `left_in_store`; `RepositoryBusyError` stays transient (`packages/adapters/test/letta/rv3.test.ts`) | ADR 0010, post-merge amendment of 2026-11-13; ADR 0028, amendment of card RV3; `docs/log/2026-11-19-rv3-decision-letta-refusals-leave-backlog.md` |
| Deletion report surfaces | no CLI command or server route reads a deletion report's `left_in_store`, so the person is not shown which store records to delete by hand | ADR 0010, post-merge amendment of 2026-11-13 |
| ADRs for the lead | ADR 0034 (card E9.4, the grant change) is proposed, with its two open questions (an expiry cap; an expired or other-class grant on a first write). ADR 0018's amendment made when implementing card L1 (2026-11-06: the exact duplicate lint's strict form) awaits the lead's review. Everything else this row held was accepted on 2026-11-19 (ADRs 0031 to 0033 and the amendments of 2026-11-02 and 2026-11-13) | `docs/decisions/0018-duplicates-without-embeddings.md`; `docs/log/2026-11-19-lead-decision-adrs-accepted.md` |

## Follow-ups from card L3's review (2026-11-19)

Found by the review of PR #45 and left open on purpose; neither blocks card L4.

| item | what is left | where it is recorded |
|---|---|---|
| Events to members who may not read | `eventVisibleTo` (packages/core/src/visible.ts) shows an event to any member of its scope, even one the read matrix stops from reading that scope; model lint reasons now restate in-scope content, so this matters more | `docs/log/2026-11-19-l3-finding-event-visible-to-unreadable-members.md` |
| Model lints hold the write queue | `Plane.lint` keeps the write queue locked while the model answers; settle it before a server injects a lint model | `docs/log/2026-11-19-l3-finding-lint-holds-write-queue.md` |

## Follow-ups from card L2's review (2026-11-19)

Found by the review of PR #46; they need the lead or card L4, not more of L2.

| item | what is left | where it is recorded |
|---|---|---|
| Contradiction prompt and updates | card L3's contradiction prompt asks whether two statements "cannot both be true at the same time", so a model may judge an old value and a later update of the same attribute consistent; the lead or card L4 decides whether the prompt should treat a later update of the same attribute as a contradiction (a prompt change is a new cassette and an amendment) | `docs/log/2026-11-19-l2-review-finding-superseded-prompt.md` |
| H3's deterministic claim | on the seeded-fault set, deterministic recall and precision hold by construction; the lead decides whether H3 measures deterministic precision on natural memory through the audit sample and keeps seeded recall as a regression check, before the tag | `docs/log/2026-11-19-l2-review-finding-h3-wording.md` |
| B5's assistant model | B5's `turnItem` writes assistant turns with no model, which L1's missing-provenance lint flags; the lead decides for B6 and X10 whether B5 names the model or C6 leaves missing-provenance out on LongMemEval | `docs/log/2026-11-19-l2-review-finding-b5-assistant-model.md` |

## Follow-ups from card L4's review (2026-11-19)

Found by the review of PR #49; they need card L2 or the lead, not more of L4.

| item | what is left | where it is recorded |
|---|---|---|
| Injected sentences' openers | the generator's injected sentences open with phrases LongMemEval's own turns lack ("For the record, my ...", "As it stands, my ...", "These days my ..."), so a model or a reader can tell injected items from base ones; card L2 decides whether the pools should drop or vary them (a generator change re-records the set, its hashes and L4's floor) | `docs/log/2026-11-19-l4-review-finding-l2-injected-openers.md` |
| H3's live lint run size | the full set costs 95,217 model calls, 26,739 of each seed's 28,739 contradiction calls on no label; a subset departs from H3's stopping rule and needs an amendment, and the runner has no seeded sampler of questions; the lead decides | `docs/log/2026-11-19-l4-review-finding-live-count.md` |

## Follow-ups from card B6 (2026-11-19)

Found by the work on card B6 and the review of PR #51.

| item | what is left | where it is recorded |
|---|---|---|
| LongMemEval judge in the Models section | the lead names LongMemEval's judge in the pre-registration's Models section: H2's baselines judge with the paper's model through OpenRouter, `openrouter/openai/gpt-4o-2024-08-06`, temperature 0, 10 tokens, one call per session; today only the configs and a decision entry name it, and the Models section names GateMem's judge only | `docs/log/2026-11-19-b6-decision-judge-route.md`; `research/configs/h2-longmemeval-c5-medium.json` |
| H2 clock choice | the lead chooses how H2 treats preset medium's 90-day ttl on LongMemEval (it hides turns in 54 of 500 questions at B5's read time): keep and report with a descriptive sensitivity set (recommended, with the exact line), read at another clock, or a LongMemEval preset; decided before the tag | `docs/tasks/B6.md`; `docs/log/2026-11-19-b6-finding-clock-options-bound.md` |
| Embedded Postgres teardown on Windows | vitest's embedded-Postgres teardown fails with `EBUSY` on Windows under load, which turns a `make test` whose tests all pass into exit 1; the teardown should retry or tolerate a busy folder | PR #51 review |

## Follow-ups from card E9.4 (2026-11-19)

Found by the work on card E9.4 and the review of PR #44, and left open on purpose.

| item | what is left | where it is recorded |
|---|---|---|
| In-place promotion across log handles | done by card E2.6 on branch `e2-6`, awaiting review: `Plane.promote` checks its decision under the log's lock before it appends, in place and as a new version, and refuses a stale one (`engram/promote/conflict`), putting the store back (orderings R9 and R9b of `packages/core/test/unit/plane/cross-handle.test.ts`); ADR 0007's amendment of 2026-11-19 | `docs/log/2026-11-19-e9-4-review-finding-promote-race.md` |
| Grants seen by a grantee | a read returns every grant on an item, so a grantee learns who else may read it; the inspector shows a non-owner only its own grants, the API does not | ADR 0034, decision 9; `docs/log/2026-11-19-e9-4-review-finding-grantee-sees-all-grants.md` |
| Granting Claude Code's own memories | the files adapter holds a memory file Claude Code wrote read-only, so it cannot be granted; grants held by the plane alone, or a copy into an Engram item, would allow it | ADR 0034, consequences; `docs/log/2026-11-19-e9-4-finding-claude-code-memories-cannot-be-granted.md` |
| Re-adoption of plane writes | an item the plane writes into a files folder is re-adopted once as `import` by the next adoption | `docs/log/2026-11-19-e9-4-finding-plane-writes-readopted-as-import.md` |
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
| Knowledge profile dogfood | Gate D asks that the Knowledge and Twin profiles run on dogfood data with zero recorded violations; card E9.5 covers the Twin profile only, and no card covers a Knowledge dogfood. The lead decides: a card for it (the violation report takes any policy with `--policy`), or Gate D read as the Twin profile's | `docs/log/2026-11-19-e9-5-finding-knowledge-dogfood-uncovered.md` |
| Adoption raises trust | over the files adapter, the re-adoption after a plane write raises an agent-written item's provenance from `model` to `import`, after which its owner may grant it and a promotion reads it as `import`. Diagnosis (review of PR #48): `packages/core/src/plane/adopt.ts` lines 111 and 150, `withPlaneProvenance` overwrites the stored provenance with the adopter's `import`, so `model` becomes `import`; the fix is `leastTrusted([known.provenance.kind, "import"])`, keeping `known.provenance` for an unchanged plane-written record. Its own card after card E2.6 (PR #50) merges, since E2.6 rewrites `adopt.ts`; the twin dogfood starts only after it. Until then the violation report counts a grant on such an item as a violation | `docs/log/2026-11-19-e9-5-finding-readoption-raises-model-content.md`; `docs/log/2026-11-19-e9-5-review-failure-e95-6-raised-grant-not-a-violation.md` |
| Promotion carries grants | ADR 0034, decision 6, holds a class change of an item carrying grants to its owner, with every kept grant of the new class; `Plane.promote` builds a new version with the source's grants (`packages/core/src/policy/promotion.ts`, line 410), and a reviewer who is not the owner may make it, so an episodic item's episodic grant rides onto its semantic version, switched off. Nothing is wrongly admitted; the lead decides whether a promotion drops grants of another class, or the ADR says that a promotion carries them. The report counts such a change under `watch.narrowed` | `docs/log/2026-11-19-e9-5-review-finding-promotion-carries-grants.md` |
| An event's actor capacity | an event records the actor's id only, not its level, memberships or source, so the violation report judges reads under the flags a member declares and cannot check the source of an `engram/grant/change` event; recording them is a schema change (AGENTS.md rule 5) | `docs/log/2026-11-19-e9-5-decision-declared-actors.md` |
| The report on a Postgres log | `packages/core/scripts/dogfood-report.ts` reads a SQLite log only | `docs/log/2026-11-19-e9-5-decision-default-sqlite-log.md` |

## Follow-ups from card RV3 (2026-11-19)

Found by the repository review of the adapters and by the work on card RV3; card RV3 fixed RV-ADP-1, 2, 3, 5, 7, 8, 9 and 10.

| item | what is left | where it is recorded |
|---|---|---|
| Adoption carries grants from a dropped file (RV-ADP-4) | adoption carries the grants of a file the store dropped; the fix is in core's `packages/core/src/plane/adopt.ts`, which card E2.6 is rewriting, so card RV4 takes it after E2.6 merges | `docs/log/2026-11-19-rv3-finding-adp4-adoption-carries-grants.md` |
| What `search` means across stores (RV-ADP-6) | the files and Letta adapters keep an item only when every query term is in its content, the Mem0 adapter ranks by embedding similarity, and ADR 0013 says nothing of what a hit means, so one read differs by store; the lead decides | `docs/log/2026-11-19-rv3-finding-adp6-search-across-stores.md` |
| Adoption after a folder move | moving an adopted files folder gives its files new imported ids at the same refs; core's `refProblem` (`packages/core/src/plane/write.ts`) counts retired holders too, so every adoption and every `engram read` of the moved folder fails closed with one deny event (moving it back recovers). The fix: adoption retires a holder of the same ref whose id is the same file's imported id under an older folder identity. Card RV4 takes it after card E2.6 (PR #50), which rewrites `write.ts` and `adopt.ts` | ADR 0013, amendment of card RV3; `packages/adapters/test/plane/rv3-files.test.ts`; `docs/log/2026-11-19-rv3-review-failure-rv3-1-folder-move.md` |
| One log, two files folders | core keys a ref by adapter name and file name, and every surface names the files store `files`, so a second folder adopted into the same log is refused; a surface flag for the adapter name, or refs that name the folder, would allow it | `docs/log/2026-11-19-rv3-finding-one-log-two-folders.md` |
| Retired titles in Letta's index | the Letta adapter's `engram/MEMORY.md` keeps a line with the title of every item, retired ones included, which an agent opening the index reads; drop the title, or the line of a retired item | ADR 0028, amendment of card RV3; `docs/log/2026-11-19-rv3-finding-letta-index-keeps-retired-titles.md` |

## Follow-ups from card RV1 (2026-11-19)

Built by card RV1 (the repository review's RV-EXP-1 to -5 and -10) with proposed values; each needs the lead before the tag.

| item | what is left | where it is recorded |
|---|---|---|
| Turn limit | the runner caps a session at the config's `turn_limit` and excludes a capped session under the reason `turn limit`; the lead sets the value (proposed: 8 model calls per session in every experiment config, twice the cost estimate's high case) and the exclusion rule (proposed: excluded, counted per condition beside the other exclusions), and words it into the pre-registration | `docs/log/2026-11-19-rv1-decision-turn-limit-default.md`; `docs/log/2026-11-19-rv1-decision-turn-limit-not-keyed.md` |
| Spend ceiling | the runner stops at the config's `spend_ceiling_usd`, per provider, and keeps the completed subset; the lead sets each experiment config's value (proposed: 1.25 times the run's high cost estimate for the named model) once decision sheet item 1 names the models | `docs/log/2026-11-19-rv1-decision-spend-ceiling-default.md` |
| Deterministic answer failure | a deterministic failure of the answer model (a 400, for example a C1 prompt over the model's context limit) stops a live run for good, with no record and no exclusion reason; the lead decides how such a session is excluded, or the configs are checked against each model's context limit before the tag | `docs/log/2026-11-19-rv1-finding-answer-400-stops.md` |
| Concurrent writers | two processes writing the same `--out` folder interleave their rows; a lock file in the folder would guard it (a card) | `docs/log/2026-11-19-rv1-finding-concurrent-writers.md` |
| Capped utility sessions | a capped GateMem utility session leaves MGS's U with no count, since h1-sessions/2 allows no exclusion on a utility row; the lead decides whether the H1 table counts them per condition | `docs/log/2026-11-19-rv1-review-failure-4-utility-gap.md` |
| v1's condition wording | v1 does not describe C3's identity and instruction sentences or C4's instruction sentence; the proposed lines are in the finding, for the lead's text | `docs/log/2026-11-19-rv1-finding-v1-condition-wording.md` |
