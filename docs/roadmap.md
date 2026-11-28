# Engram roadmap

> **Status: living document, subject to change.** This roadmap is the plan as of its date. Phases, cards, estimates, tooling and ordering will change if the team decides to, or finds a better approach. Known deltas since v1: the plane is built on pi (ADR 0001), so cards E0.1, E0.3, E8.1 and E8.3 are to be rewritten and cards PX1 to PX3 and RN1 to RN2 added (see `docs/decisions/README.md` and `docs/tasks/step-0.md`). Decisions that change this document are recorded as ADRs and entries under `docs/log/`. The repository copy is the current version; exported HTML and PDF are snapshots.

Twenty-six weeks, two tracks, four gates, sixty-one task cards, one script that regenerates every table.

Dates assume a start on Monday 5 October 2026 and submission in the last week of March 2027. If the department's calendar differs, the week numbers hold and the dates shift.

**Status: living document, subject to change.** This roadmap is the plan as of its date. Phases, cards, estimates, tooling and ordering will change if the team decides to, or finds a better approach. Known deltas since v1: the plane is built on pi (ADR 0001), so cards E0.1, E0.3, E8.1 and E8.3 are to be rewritten and cards PX1 to PX3 and RN1 to RN2 added (see docs/decisions/README.md and docs/tasks/step-0.md). Decisions that change this document are recorded as ADRs and log entries, and the current version always lives in the repository.

**The absorb plan, 2026-11-21.** Thirty pull requests were added from the absorb and state-of-the-art research of that day: twenty-six new cards, and cards B7, D1, D2 and D3 rewritten. The list, with why and how for each, is `docs/tasks/absorb-plan.md`; the cards are in the section "The absorb plan" under Task cards, their weeks under "The absorb plan in the week plan", and their cost under Effort budget. The plan moves D1 to D3 and B7 earlier than the week plan below says. Its eight decisions (items 49 to 56 of `docs/tasks/lead-decisions.md`) were closed the same day under the lead's delegation, and ADRs 0038 to 0041 accepted.

**The second absorb plan, 2026-11-25.** The lead asked for another thirty pull requests from the absorb research. They are `docs/tasks/absorb-plan-2.md`: twenty-eight new cards, and cards D4 and E8.8 rewritten. Their cards are in the section "The second absorb plan" under Task cards, their weeks under "The second absorb plan in the week plan", their cost under Effort budget. No card in it bumps `schema_version`, and nothing that changes code a registered config runs merges between the `prereg-v1` tag and the merge of H1's shards.

**The answers of 2026-11-20.** The lead chose the three models, and the orchestrating session answered every other open decision under the lead's delegation (`docs/tasks/lead-decisions.md`, items 1 to 48 and the review cards' table). The answers card of 2026-11-21 carried them into the pre-registration, the ADRs and this roadmap: Gate C's undecided branch, Gate D's store and dogfood criteria, the dates, the variance bound, the spend ceiling and where the cassettes go. Two drafts were owed to the lead. The kill list's rewrite (item 26, proposed below) still waits for the lead's approval. H5's prerequisites (item 30) are drafted by card H5P (#121, merged 2026-11-27) as a proposed amendment in `docs/research/preregistration.md` ("H5's prerequisites, drafted for the lead"), with twenty-two proposed values listed in `docs/tasks/H5P.md`; nothing is registered until the lead approves the text.

1.  [Where things stand, 2026-11-28](#state)
2.  [Planning principles](#principles)
3.  [Phases and gates](#phases)
4.  [Timeline at a glance](#gantt)
5.  [Week by week](#weeks)
6.  [Task cards](#cards)
7.  [Dependency map](#deps)
8.  [Effort budget](#effort)
9.  [Compute and data budget](#compute)
10. [Conventions and definition of done](#conventions)
11. [Writing schedule](#writing)
12. [Risk triggers and the kill list](#risks)
13. [Appendix: deferred items](#appendix)

## Where things stand, 2026-11-28

Written on Saturday 28 November, the last weekend of week 8 (23 to 29 November), from the card files under `docs/tasks/`, the merged pull requests and the log. The sections after this one are the plan; this section and its table are the state.

**The gate.** The project is in phase 2, "First result", between Gate B and Gate C. Gate A was declared passed with two exceptions on 2026-10-29 (`docs/log/2026-10-29-gate-a-milestone-corrected.md`). Gate B's engineering was done on 2026-10-29 and proposed as passed with exceptions (a) and (c) (`docs/log/2026-10-29-gate-b-engineering-done.md`); no entry records the lead declaring it (`docs/log/2026-11-21-readme-finding-gate-b-undeclared.md`). Both exceptions are met by pre-tag condition 4's live checks: B1 is exception (a), and the smoke run takes GateMem probes through the plane on M1, the live half of criterion 4 and so exception (c) (`docs/tasks/gate-b-plan.md`, section 7; `docs/log/2026-11-28-roadmap-decision-gate-b-exceptions.md`). Gate C, at the end of week 10 (13 December), needs H1's table.

**Merged since the second absorb plan (2026-11-25).** ANS-2026-11-25, the lead's acceptance of ADRs 0034 and 0042 to 0048 (#113). E8.15, the terminal interface `engram tui` (#114), and the READMEs after it (#115). The gate-work cards R5, R6, X20, X21, X22, X23, L10 and E9.17 with the lead's answers of 2026-11-26 (#116); then X21 (#117), R5 (#118, #119), R6 (#120), H5P as a proposed amendment with nothing registered (#121), X20 (#122) and the runbook's credit check (#123, `docs/tasks/prereg-v1-plan.md`, "The commands that run H1 once the key exists"). Then L8 (#124), E9.9 (#125), E2.21 part 1 (#126) and RD1 (#127). Every card of the first absorb plan is now merged (`docs/tasks/absorb-plan.md`, with E8.15, E9.9 and L8 added to its table), so the nine it placed before Gate C are merged and the Effort budget's trigger ("fewer than seven of the nine") cannot fire. No card of the second absorb plan has merged.

**Results.** All 24 rows of `research/results/MANIFEST.md` matched their sha256 under `make test-repro` at `42131029`, RD1's branch with main through #126 merged in; the commits after it, up to main's head `b30cdffd`, change tests and log entries only (PR #127's description; `git diff --stat 42131029 b30cdffd`). They had matched at X20's head too (`docs/log/2026-11-27-x20-measurement-test-repro-at-head.md`). No registered result exists yet: H1 has not run.

**Pre-tag conditions** (`docs/research/preregistration.md`, header). Done: 2 (card R5, 2026-11-26), 3 (cards X20 and X21, 2026-11-26), 5 (card R6, 2026-11-26) and 6 (the answers card, 2026-11-21). Left, before the `prereg-v1` tag on 30 November:

| Condition | What is left | Who |
|---|---|---|
| 1 | The label audit (Omar, Mohamad and Shady, 23 to 28 November; `docs/research/label-audit.md`), then the PR that writes its rates, kappas and rejected items into the Benchmarks section, whose place still reads "label audit not yet done" | the three members, then the lead |
| 4 | The smoke run and B1, live: the smoke run on M1 (`openrouter/deepseek/deepseek-v4-pro-0813` on Wafer's `wafer/us`, an mxfp4 build), B1 on GPT-5.4; priced at 0.53 to 4.26 and 2.06 to 6.04 USD (`research/results/h1-check-runs-cost.json`), about 3 to 10 USD together; commands in `docs/tasks/prereg-v1-plan.md`, "The live checks before the tag (card RV6)" | the lead, with the key |
| 7 | Held for H1 by the operator's credit check (OpenRouter's balance before the first live command and at least every two hours, `docs/tasks/prereg-v1-plan.md`), until card X22 has the runner enforce the cap after H1's `MERGE=4` (the lead's answer to Q1 of 2026-11-25) | the operator of H1's runs |
| 8 | The tag on the commit that holds the final text, and its Zenodo deposit by 30 November (ADR 0023), recorded as a `milestone` entry | the lead |

Also the lead's, before the tag or at the latest before H1's data exist (lead-decisions item 9): reading H5P's twenty-two proposed values (`docs/tasks/H5P.md`), and the pre-registration header's sentence "on the commit he tags", whose pronoun is the lead's to keep or change. The lead's approval of the kill list's rewrite (item 26, under Risk triggers) and the declaration of Gate B remain open, with no date.

**Dates ahead.** The `prereg-v1` tag and Zenodo deposit by Monday 30 November (W9). H1 live from 1 to 8 December: the GateMem arm as 4 shards (`SHARD=i/4`, card RV6) joined with `MERGE=4`, and the MEM-INV-Bench arm (cards X2 and X3). During the runs only tests, specs, research scripts and new read-only commands merge; core changes, new configs and new MANIFEST rows resume after `MERGE=4` ("The second absorb plan in the week plan", below). Gate C at the end of W10, 13 December. Gate D at the end of W16, 24 January 2027. Experiments freeze at the end of W21, 28 February; submission in the last week of March.

**Open findings, each left to a later card.** Core's property test "rebuild equals incremental" (`packages/core/test/replay/rebuild.test.ts`) times out on embedded Postgres under the full suite's load and passes alone (`docs/log/2026-11-26-e8-15-failure-rebuild-timeout-on-postgres.md`): a core card after H1. Card X20's Goal calls a plain 400 an exclusion while its acceptance keeps it a stop, and it stays a stop for H1 (`docs/log/2026-11-27-x20-finding-goal-and-acceptance-disagree.md`): a card after `MERGE=4`. Core should state on each answer whether the grants it shows are all of them (`docs/tasks/backlog.md`, row "Grants shown, stated by core"; `docs/log/2026-11-27-rd1-finding-grants-shown-inferred.md`): after H1. Card E2.21's part 2, the one-year grant cap and first-write rule behind `grants.expiry_cap`: after `MERGE=4`, before E2.15 (`docs/log/2026-11-27-e2-21-decision-split-opt-in.md`).

### What is left

Every card not done, from the original cards, both absorb plans and the gate-work cards, grouped by the phase the week plan places it in, with its week. "Not started" means no pull request for the card has merged. A card whose engineering merged but whose acceptance needs a live run is listed with what is left. The status lines of several merged cards still read "awaiting review"; here the merged pull requests decide (`docs/log/2026-11-28-roadmap-decision-status-from-merged-prs.md`).

| Card | What is left | Status | Depends on, or waits for |
|---|---|---|---|
| **Before the tag (W8, by 30 November)** | | | |
| R1 | v1 tagged and deposited (drafted in #27, answered in #43 and #80) | waiting on the lead | pre-tag conditions 1, 4, 7 and 8 |
| B1 | the live reference check, Gate B's exception (a) (pipeline merged in #6) | waiting on the lead | the key; pre-tag condition 4 |
| H5P | the lead's reading of the twenty-two proposed values (drafted, #121) | waiting on the lead | none; before H1's data exist (item 9) |
| E0.6 | `make lint-docs` checks the absorbed register | not started (planned W8) | none |
| E0.7 | determinism guards in tests | not started (planned W8) | none |
| **Phase 2, to Gate C (W9 and W10, 30 November to 13 December)** | | | |
| X2 | H1 on GateMem, live, 4 shards and `MERGE=4` | not started; ready | the tag and the key; 1 to 8 December |
| X3 | H1 on MEM-INV-Bench, live | not started; ready | the tag and the key; 1 to 8 December |
| X4 | H1's read-out and figure (code merged in #26 and #57), with the two readers' UNREAD readings | blocked by X2 and X3 | X2, X3 |
| E8.16 | cross-surface parity and leak suite (W9) | not started | RD1 (merged, #127) |
| E1.8 | Quint traces replayed against the Plane (W9) | not started | none |
| E9.10 | `engram discover` (W9) | not started | none |
| X22 | the runner enforces the programme-wide spend cap (W10) | after H1's `MERGE=4` | X20 (merged, #122); before any later live run |
| E2.21 part 2 | the one-year grant cap and first-write rule, opt-in (W10) | after H1's `MERGE=4` | part 1 (merged, #126) |
| X16 | gate mutation audit (W10) | not started; its MANIFEST row after `MERGE=4` | none |
| X17 | the results page (W10) | not started; its MANIFEST row after `MERGE=4` | none |
| E1.7 | erasure: the two gaps the Quint model found (W10) | after H1's `MERGE=4` | E1.8 |
| E2.14 | the policy schema's new options, `grants.expiry_cap` among them (W10) | after H1's `MERGE=4` | none |
| E2.15 | provenance across rewrites, closes and imports (W10) | blocked by E2.21 part 2 | E2.21 part 2 |
| B5 | the ungoverned LongMemEval baseline on M1 (engineering merged in #37) | after H1's `MERGE=4` | the tag, the key, X22 |
| B6 | the enforced LongMemEval baseline on M1 (engineering merged in #51) | after H1's `MERGE=4` | the tag, the key, X22 |
| E8.7 | findings view with resolve actions | not started (planned W7) | L1, E8.5 (both merged) |
| **Phase 3, to Gate D (W11 to W16, 14 December to 24 January)** | | | |
| X23 | the request-identity check on files, Mem0 and Letta (W11) | after H1's `MERGE=4` | `MERGE=4` |
| L10 | the contradiction prompt counts a later update (W11) | after H1's `MERGE=4` | R6 (merged, #120) |
| L3 | the live variance pilot (engineering merged in #45) | blocked by L10 | L10, the key, X22 |
| X18 | the paired fault-injection check for H3 (W11) | not started | none |
| X19 | the erasure-residue check (W11) | blocked by E1.7 | E1.7 |
| E2.16 | the content guards' gaps (W11) | not started | none |
| E1.9 | the chain on every writer and over attestations; race-free migration (W11) | not started | none |
| E9.11 | crypto-shredding ADR and key table (W11) | blocked by E1.7 | E1.7 |
| X5 | frontier design (W11) | blocked by X4 | X4, E2.4 (merged) |
| X6 | frontier run, primary model (W12) | blocked by X5 | X5, A2 (merged) |
| E9.3 | Knowledge screens (W12) | blocked by E8.7 | E9.1 (merged), E8.7 |
| L9 | quote-grounding for the model lints (W12) | blocked by E2.14 | E2.14 |
| D5 | the procedure safety scan (W12) | blocked by E2.14 | E2.14 |
| A6 | the MCP memory server as a fourth store (W12) | not started | none |
| E2.17 | why not this item (W12) | not started | RD1 (merged, #127) |
| E9.12 | do not record (W12) | blocked by E2.14 | E2.14 |
| E8.17 | Codex under the gate (W12) | not started | none |
| D4 | drift and retirement (W13) | not started | D3 (merged, #99) |
| E2.18 | Cedar symbolic proofs (W13) | not started | none |
| E9.13 | crypto-shredded erasure in offboarding (W13) | blocked by E9.11 and X19 | E9.11, X19 |
| E2.19 | the approval queue (W13) | blocked by E2.14 | E2.14, E9.9 (merged, #125) |
| E9.17 | the Knowledge dogfood kit (W13); the members run it in W14 and W15 | blocked by E9.5 | E9.5 |
| X7 | frontier run, second model, with MERIT (W14) | blocked by X6 | X6, B7 (merged) |
| E9.5 | the two weeks of twin dogfood (kit merged in #48) (W14) | waiting on the lead's go | each member's hook check (`docs/dogfood.md`, "When it starts") |
| E9.14 | the signed erasure receipt (W14) | blocked by E9.13 | E9.13 |
| E8.8 | approvals on every surface (W14) | blocked by E2.19 | E2.19 |
| X8 | frontier run, third model (W15) | blocked by X7 | X7 |
| B8 | HaluMem harness (W15) | blocked: HaluMem is unregistered, CC-BY-NC-ND-4.0 (`docs/log/2026-11-19-lead-decision-halumem-unregistered.md`) | a decision to register it |
| E8.10 | diff view (W15; on the kill list) | not started | E1.3, E8.5 (both merged) |
| E2.20 | `engram policy test` and `policy diff` (W15) | not started | none |
| E9.15 | the signed audit report (W15) | not started | none |
| X9 | H2 and H4 analysis, frontier figure (W16) | blocked by X6 to X8 | X6, X7, X8 |
| E9.16 | subject access export and Article 30 record (W16) | not started | none |
| **Phase 4 (W17 to W21, 25 January to 28 February)** | | | |
| X10 | H3 recovery (W17) | blocked by L10 and X22; its HaluMem half by B8 | L4 (merged), B8 |
| E9.6 | Procedures screens (W18) | blocked by E8.8 | D3 (merged), E8.8 |
| X11 | H5's runs (W19) | blocked by H5P's approval and by an H5 harness card not yet written | D3 (merged), H5P approved |
| B9 | MemoryAgentBench forgetting split (W20; item 1 of the proposed kill list) | not started | E2.4 (merged) |
| X12 | failure analysis (W20) | blocked by X9, X10 and X11 | X9, X10, X11 |
| **Phase 5 (W22 to W26, 1 March to 4 April)** | | | |
| X13 | the reproduction script from a fresh clone (W22) | blocked by every X card | all X |
| **Not scheduled** | | | |
| B2 | MPBench pin | backlogged by the lead on 2026-10-22; MEM-INV-Bench runs in its place (ADR 0029) | an MPBench release |
| RN2 | the durable runner behind `ENGRAM_RUNNER=durable` | not started; no week | RN1 (merged, #7) |

## Planning principles

1.  **The research result lands early.** The enforcement-versus-instruction experiment (H1) runs in week ten on the primary model. Everything after week ten is either widening that result or building the product around it. A thesis with a result in hand by week ten cannot fail for lack of time.
2.  **Two tracks, one repository.** The research track owns the memory model, adapters, policy engine, benchmark harnesses and experiments. The product track owns surfaces, profiles, inspector and dogfood. Product cards never block research cards.
3.  **Gates, not hope.** Four go/no-go gates with written criteria. A gate that fails triggers a pre-decided response, not a meeting.
4.  **Cards are the unit of work.** Each card is a complete brief for a coding-agent session: goal, files, dependencies, acceptance command. Cards in different packages run in parallel sessions. One card, one PR.
5.  **Everything regenerates.** No number enters the thesis unless a script in `experiments/scripts/` produces it from `experiments/configs/` and committed caches.
6.  **Dogfood from week two.** The files adapter makes the team's own Claude Code memory inspectable in week two. The team are the first users and the twin profile's first subjects.

## Phases and gates

| Phase                       | Weeks    | Dates            | Purpose                                                                                                              | Exit       |
|-----------------------------|----------|------------------|----------------------------------------------------------------------------------------------------------------------|------------|
| 0\. Contracts               | 1 to 2   | 5 Oct to 18 Oct  | Repository, schema, interfaces, pre-registration draft, benchmark harnesses pinned, files adapter and dogfood on     | Gate A     |
| 1\. Plane                   | 3 to 6   | 19 Oct to 15 Nov | Event log, policy engine, Mem0 and Letta adapters, conformance suite, GateMem and MPBench wired, inspector v0        | Gate B     |
| 2\. First result            | 7 to 10  | 16 Nov to 13 Dec | Enforcement versus instruction on the primary model; LongMemEval baseline; deterministic lints; CLI and MCP surfaces | Gate C     |
| 3\. Frontier                | 11 to 16 | 14 Dec to 24 Jan | Policy sweeps, hosted models, MERIT, seeded faults and model-based lints, Knowledge and Twin profiles, simulator     | Gate D     |
| 4\. Procedures and recovery | 17 to 21 | 25 Jan to 28 Feb | Procedural module and H5, lint recovery H3, forgetting split, failure analysis, chapters 3 to 7 drafted              | Freeze     |
| 5\. Reproduce and defend    | 22 to 26 | 1 Mar to 4 Apr   | Reproduction script, release, thesis, workshop submission, defense rehearsal                                         | Submission |

**Gate A, end of week 2.** Pass if: schema generates JSON Schema and TypeScript types with no diff on a clean tree; pre-registration v0 committed and dated; GateMem and MPBench run end to end on their own reference agents from pinned commits; the files adapter shows a team member's Claude Code memory in the CLI. Fail response: extend phase 0 by one week, take the week from phase 3's inspector polish.

**Gate B, end of week 6.** Pass if: both adapters pass the conformance suite; a policy file denies a cross-scope read on both stores with the same event recorded; the event log reproduces a recorded workload's item set from events alone; GateMem probes run through the plane on the primary model; also, carried from Gate A as pass criteria of Gate B (Gate A declared passed with two exceptions on 2026-10-29, `docs/log/2026-10-29-gate-a-milestone-corrected.md`): (a) GateMem's reference numbers within tolerance, on the ported judge, once the pre-registration leaves the backlog; (b) the poisoning arm's benchmark chosen and dated (MPBench if released, else MEM-INV-Bench, else BF1). Fail response: drop the Letta adapter to files-plus-Mem0 and record the change as a limitation.

**Gate C, end of week 10.** Pass if: H1 table exists on the primary model with intervals, for ungoverned, instruction-only and enforced conditions, on GateMem and MPBench. Decision: if enforcement beats instruction, continue as planned; if it does not, pivot the thesis to characterising where boundary enforcement fails and why, keep the plane, and reallocate phase 3's hosted sweeps to failure analysis. If H1's read-out is undecided (p below 0.05, but 5p at or above it), continue as planned, report it as undecided, and let the final Holm over all five hypotheses decide (lead-decisions item 10). The poisoning arm runs on MEM-INV-Bench in MPBench's place (ADR 0029).

**Gate D, end of week 16.** Pass if: the frontier figure exists for at least two policy levels on two stores and two models; seeded-fault lint precision and recall are tabulated; Knowledge and Twin profiles run on dogfood data with zero recorded violations. Fail response: kill list items 1 and 2, then 3.

Gate D as answered on 2026-11-20 (`docs/tasks/lead-decisions.md`): "two stores" is met by the request-identity check on files, Mem0 and Letta, not by paid runs on each store (item 20, ADR 0035, decision 3). The Knowledge profile's dogfood runs beside the twin dogfood, by card E9.17 (item 28; written by the gate-work cards, #116, `docs/tasks/E9.17.md`). "Zero recorded violations" is measured on the plane, with members' Claude Code auto memory off and the native memory path stated as outside it (item 33; `docs/dogfood.md`). The fail response's kill list is being rewritten, since its items 1 and 3 are done (item 26, under the kill list).

## Timeline at a glance

<figure class="gantt">

<img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Ym94PSIwIDAgODYwIDMzMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJpbWciIGFyaWEtbGFiZWxsZWRieT0iZ1RpdGxlIj4KICAgIDx0aXRsZSBpZD0iZ1RpdGxlIj5HYW50dCBjaGFydCBvZiB0d2VsdmUgd29ya3N0cmVhbXMgYWNyb3NzIDI2IHdlZWtzIHdpdGggZm91ciBnYXRlczwvdGl0bGU+CiAgICA8ZyBmb250LWZhbWlseT0iaW5oZXJpdCIgZm9udC1zaXplPSIxMCIgZmlsbD0idmFyKC0tc3RlZWwpIj4KICAgICAgPCEtLSB3ZWVrIHRpY2tzIC0tPgogICAgICA8ZyBpZD0idGlja3MiPgogICAgICAgIDxsaW5lIHgxPSIxODAiIHkxPSIyMiIgeDI9IjE4MCIgeTI9IjMwMCIgc3Ryb2tlPSJ2YXIoLS1saW5lKSI+PC9saW5lPgogICAgICAgIDxsaW5lIHgxPSIyODMiIHkxPSIyMiIgeDI9IjI4MyIgeTI9IjMwMCIgc3Ryb2tlPSJ2YXIoLS1saW5lKSI+PC9saW5lPgogICAgICAgIDxsaW5lIHgxPSIzODYiIHkxPSIyMiIgeDI9IjM4NiIgeTI9IjMwMCIgc3Ryb2tlPSJ2YXIoLS1saW5lKSI+PC9saW5lPgogICAgICAgIDxsaW5lIHgxPSI0ODkiIHkxPSIyMiIgeDI9IjQ4OSIgeTI9IjMwMCIgc3Ryb2tlPSJ2YXIoLS1saW5lKSI+PC9saW5lPgogICAgICAgIDxsaW5lIHgxPSI1OTIiIHkxPSIyMiIgeDI9IjU5MiIgeTI9IjMwMCIgc3Ryb2tlPSJ2YXIoLS1saW5lKSI+PC9saW5lPgogICAgICAgIDxsaW5lIHgxPSI2OTUiIHkxPSIyMiIgeDI9IjY5NSIgeTI9IjMwMCIgc3Ryb2tlPSJ2YXIoLS1saW5lKSI+PC9saW5lPgogICAgICAgIDxsaW5lIHgxPSI3OTgiIHkxPSIyMiIgeDI9Ijc5OCIgeTI9IjMwMCIgc3Ryb2tlPSJ2YXIoLS1saW5lKSI+PC9saW5lPgogICAgICA8L2c+CiAgICAgIDx0ZXh0IHg9IjE4MCIgeT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPncxPC90ZXh0PgogICAgICA8dGV4dCB4PSIyODMiIHk9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj53NTwvdGV4dD4KICAgICAgPHRleHQgeD0iMzg2IiB5PSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+dzk8L3RleHQ+CiAgICAgIDx0ZXh0IHg9IjQ4OSIgeT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPncxMzwvdGV4dD4KICAgICAgPHRleHQgeD0iNTkyIiB5PSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+dzE3PC90ZXh0PgogICAgICA8dGV4dCB4PSI2OTUiIHk9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj53MjE8L3RleHQ+CiAgICAgIDx0ZXh0IHg9Ijc5OCIgeT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPncyNTwvdGV4dD4KICAgIDwvZz4KICAgIDwhLS0gMjUuNzUgcHggcGVyIHdlZWs7IHggPSAxODAgKyAod2Vlay0xKSoyNS43NSAtLT4KICAgIDxnIGZvbnQtZmFtaWx5PSJpbmhlcml0IiBmb250LXNpemU9IjEyIiBmaWxsPSJ2YXIoLS1pbmspIj4KICAgICAgPHRleHQgeD0iMCIgeT0iNDAiPkNvbnRyYWN0cyBhbmQgc2NoZW1hPC90ZXh0PiAgICAgICAgICAgIDxyZWN0IHg9IjE4MCIgeT0iMzAiIHdpZHRoPSI1MiIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXIpIj48L3JlY3Q+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjYyIj5BZGFwdGVycyBhbmQgZXZlbnQgbG9nPC90ZXh0PiAgICAgICAgICA8cmVjdCB4PSIyMzIiIHk9IjUyIiB3aWR0aD0iMTAzIiBoZWlnaHQ9IjE0IiByeD0iMiIgZmlsbD0idmFyKC0tcikiPjwvcmVjdD4KICAgICAgPHRleHQgeD0iMCIgeT0iODQiPlBvbGljeSBlbmdpbmUgYW5kIGxpbnRzPC90ZXh0PiAgICAgICAgIDxyZWN0IHg9IjI4MyIgeT0iNzQiIHdpZHRoPSIxNTUiIGhlaWdodD0iMTQiIHJ4PSIyIiBmaWxsPSJ2YXIoLS1yKSI+PC9yZWN0PgogICAgICA8dGV4dCB4PSIwIiB5PSIxMDYiPkJlbmNobWFyayBoYXJuZXNzZXM8L3RleHQ+ICAgICAgICAgICAgPHJlY3QgeD0iMjA2IiB5PSI5NiIgd2lkdGg9IjEyOSIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXIpIj48L3JlY3Q+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjEyOCI+RXhwZXJpbWVudHMgSDE8L3RleHQ+ICAgICAgICAgICAgICAgICA8cmVjdCB4PSIzMzUiIHk9IjExOCIgd2lkdGg9IjEwMyIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXIpIj48L3JlY3Q+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjE1MCI+RXhwZXJpbWVudHMgSDIgdG8gSDQ8L3RleHQ+ICAgICAgICAgICA8cmVjdCB4PSI0MzgiIHk9IjE0MCIgd2lkdGg9IjE1NSIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXIpIj48L3JlY3Q+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjE3MiI+UHJvY2VkdXJhbCBtb2R1bGUgYW5kIEg1PC90ZXh0PiAgICAgICA8cmVjdCB4PSI1OTIiIHk9IjE2MiIgd2lkdGg9IjEwMyIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXIpIj48L3JlY3Q+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjE5NCI+U3VyZmFjZXM6IEFQSSwgQ0xJLCBNQ1A8L3RleHQ+ICAgICAgICA8cmVjdCB4PSIyMzIiIHk9IjE4NCIgd2lkdGg9IjIwNiIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXApIj48L3JlY3Q+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjIxNiI+SW5zcGVjdG9yIFVJPC90ZXh0PiAgICAgICAgICAgICAgICAgICA8cmVjdCB4PSIzMDkiIHk9IjIwNiIgd2lkdGg9IjI4MyIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXApIj48L3JlY3Q+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjIzOCI+UHJvZmlsZXMgYW5kIGRvZ2Zvb2Q8L3RleHQ+ICAgICAgICAgICA8cmVjdCB4PSIyMDYiIHk9IjIyOCIgd2lkdGg9IjI2IiBoZWlnaHQ9IjE0IiByeD0iMiIgZmlsbD0idmFyKC0tcCkiPjwvcmVjdD48cmVjdCB4PSI0MzgiIHk9IjIyOCIgd2lkdGg9IjIwNiIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXApIj48L3JlY3Q+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjI2MCI+V3JpdGluZzwvdGV4dD4gICAgICAgICAgICAgICAgICAgICAgICA8cmVjdCB4PSI1NDEiIHk9IjI1MCIgd2lkdGg9IjI4MyIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXApIj48L3JlY3Q+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjI4MiI+UmVwcm9kdWNlIGFuZCByZWxlYXNlPC90ZXh0PiAgICAgICAgICA8cmVjdCB4PSI3MjEiIHk9IjI3MiIgd2lkdGg9IjEwMyIgaGVpZ2h0PSIxNCIgcng9IjIiIGZpbGw9InZhcigtLXApIj48L3JlY3Q+CiAgICA8L2c+CiAgICA8IS0tIGdhdGVzIC0tPgogICAgPGcgZm9udC1mYW1pbHk9ImluaGVyaXQiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9InZhcigtLXgpIj4KICAgICAgPGxpbmUgeDE9IjIzMSIgeTE9IjIyIiB4Mj0iMjMxIiB5Mj0iMzAwIiBzdHJva2U9InZhcigtLXgpIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWRhc2hhcnJheT0iNCAzIj48L2xpbmU+PHRleHQgeD0iMjMxIiB5PSIzMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkdhdGUgQTwvdGV4dD4KICAgICAgPGxpbmUgeDE9IjMzNCIgeTE9IjIyIiB4Mj0iMzM0IiB5Mj0iMzAwIiBzdHJva2U9InZhcigtLXgpIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWRhc2hhcnJheT0iNCAzIj48L2xpbmU+PHRleHQgeD0iMzM0IiB5PSIzMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkdhdGUgQjwvdGV4dD4KICAgICAgPGxpbmUgeDE9IjQzNyIgeTE9IjIyIiB4Mj0iNDM3IiB5Mj0iMzAwIiBzdHJva2U9InZhcigtLXgpIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWRhc2hhcnJheT0iNCAzIj48L2xpbmU+PHRleHQgeD0iNDM3IiB5PSIzMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkdhdGUgQzwvdGV4dD4KICAgICAgPGxpbmUgeDE9IjU5MiIgeTE9IjIyIiB4Mj0iNTkyIiB5Mj0iMzAwIiBzdHJva2U9InZhcigtLXgpIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWRhc2hhcnJheT0iNCAzIj48L2xpbmU+PHRleHQgeD0iNTkyIiB5PSIzMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkdhdGUgRDwvdGV4dD4KICAgIDwvZz4KICA8L3N2Zz4=" />

<span class="lr">research track</span><span class="lp">product track</span><span class="lx">gate</span>

<figcaption>Research bars front-load the result; product bars widen from week three and carry the writing and release. The gates sit where a wrong assumption would cost the most to carry forward.</figcaption>
</figure>

## Week by week

Each line names what is in flight and what must be true on Friday. R is the research track (lead plus engineer A, with C from week five), P is the product track (engineer B, with C until week five).

### Phase 0. Contracts

W1

R: E0.1 scaffold, E0.2 schema, E0.3 interfaces. P: E0.4 compose, E0.5 AGENTS.md, name and trademark check. Friday: `make test` green on an empty suite; AGENTS.md merged; team installs the repo.

W2

R: R1 pre-registration v0; B1 and B2 pin GateMem and MPBench and run their reference agents; A3 files adapter. P: E8.1 API skeleton; dogfood on (every member's Claude Code memory visible through `engram read`). Friday: Gate A.

### Phase 1. Plane

W3

R: E1.1 event log, E1.2 memory item store, A1 Mem0 adapter started. P: E8.2 CLI, E8.3 generated clients. Friday: an item written through the plane lands in Mem0 with an event.

W4

R: A1 complete, A4 conformance suite, A2 Letta adapter started. P: E8.4 MCP server, UI scaffold. Friday: Mem0 passes conformance; MCP client lists tools.

W5

R: E2.1 policy loader, E2.2 read scope filter, E2.3 write gate; A2 complete. C moves to R. P: E8.5 inspector v0 (lanes, timeline). Friday: cross-scope read denied on both stores with identical events.

W6

R: B3 GateMem through the plane, B4 MPBench through the plane, E1.3 replay-from-events test. P: E8.6 explain endpoint and view. Friday: Gate B.

### Phase 2. First result

Dates set on 2026-11-20 (`docs/tasks/lead-decisions.md`, item 18): the label audit 23 to 28 November; the `prereg-v1` tag and its Zenodo deposit by 30 November; H1's live runs 1 to 8 December, the GateMem arm on 4 shards (card RV6). The smoke run and B1 run before the tag (item 7).

W7

R: X1 condition runner (ungoverned, instruction, enforced), primary provider wired with caching, B5 LongMemEval harness. P: E8.7 findings view, E9.1 Knowledge profile policy file. Friday: one GateMem probe runs under all three conditions.

W8

R: X2 H1 run on GateMem (local). L1 deterministic lints. P: E8.8 review queue UI. Friday: first violation-rate table with binomial intervals.

W9

R: X3 H1 run on MPBench (local), B6 LongMemEval baseline under ungoverned and enforced. P: E9.2 Twin profile policy file, scope split on dogfood. Friday: poisoning-success table; LongMemEval baseline.

W10

R: X4 H1 analysis with paired bootstrap and Holm; interim report to supervisor. P: inspector shows H1 runs. Friday: Gate C.

### Phase 3. Frontier

W11

R: X5 policy sweep design (three strictness levels), E2.4 retention and budgets, hosted model access confirmed. P: E8.9 simulator CLI. Friday: sweep configs committed.

W12

R: X6 frontier run, primary model, both stores, GateMem plus LongMemEval. P: E9.3 Knowledge profile screens. Friday: first frontier points.

W13

R: L2 seeded-fault generator, L3 model-based lints (contradiction, unsupported), B7 MERIT harness. P: E9.4 Twin profile screens, grants UI. Friday: lint precision and recall on a pilot set.

W14

R: X7 frontier run, hosted model one, GateMem plus LongMemEval subset plus MERIT. P: E9.5 twin dogfood: every member runs a twin for two weeks (it may start earlier: cards E2.6, RV4 and RV7 are merged and the twin profile's values are accepted, so it waits only on each member's hook check and the lead's go; items 31 and 32). Friday: hosted points on the frontier.

W15

R: X8 frontier run, hosted model two; L4 lint evaluation full set; B8 HaluMem harness. P: E8.10 inspector diff view. Friday: lint table; HaluMem baseline.

W16

R: X9 H2 and H4 analysis; frontier figure v1. P: dogfood violation report (must be zero). Friday: Gate D.

### Phase 4. Distill and recovery

W17

R: X10 H3 recovery runs (enforced plus lints at matched budget), LongMemEval and HaluMem. P: D1 session recorder for tau2 and repository tasks. Friday: recovery deltas.

W18

R: D2 induction (published method, cited) producing candidates; D3 replay validation gate. P: E9.6 Procedures profile screens, candidate queue. Friday: first admitted skill.

W19

R: X11 H5 runs on tau2 and repository tasks with and without admitted skills; D4 drift detection if time. Writing: chapters 3 and 4 drafted. Friday: H5 table.

W20

R: B9 MemoryAgentBench forgetting split under retention policies (kill list item 3 if behind); X12 failure analysis, five worked examples. Writing: chapters 5 and 6 drafted. Friday: failure analysis doc.

W21

R: experiments frozen; final seeds and caches committed. Writing: chapter 7 and chapter 8 drafted. Friday: freeze.

### Phase 5. Reproduce and defend

W22

R: X13 reproduction script on a fresh clone from committed caches. P: release packaging, quickstart timed under ten minutes by a teammate who has not seen the repo. Writing: introduction, related work.

W23

Writing: limitations, conclusion, roadmap appendix. P: public repository under Apache-2.0 (ADR 0020), docs site. Friday: full draft to supervisor.

W24

Revisions from supervisor; workshop paper cut from chapters 4 to 6; defense deck from the inspector screens. Friday: workshop submission.

W25

Adversarial Q&A rehearsal: each member attacks one chapter; answers written into the deck. Final proofread. Friday: thesis submitted.

W26

Buffer. If unused, spend on the third adapter spike or the legal appendix outline.

### The absorb plan in the week plan

Added on 2026-11-21 (`docs/tasks/absorb-plan.md`). These cards need no API key and are worked beside the cards above. Where a week is full, a live run and its analysis come first and an absorb card moves to the next week. Before the `prereg-v1` tag on 30 November only documents and tests merge.

| Week | Dates | Research lane | Product lane |
|---|---|---|---|
| W8 | 23 to 29 Nov | R2 proposed arms, R3 novelty claim, E2.7 trust counterexamples, A5 conformance cases, E1.4 stateful test and crash windows | |
| W9 | 30 Nov to 6 Dec | B10 cassette proxy, X15 plane overhead | |
| W10 | 7 to 13 Dec | R4 crosswalk, E1.5 Quint model | |
| W11 | 14 to 20 Dec | B7 MERIT, B11 tau2-bench, D1 session recorder, E2.8 policy schema | |
| W12 | 21 to 27 Dec | E2.9 secret and personal-data guard, E2.10 injection screen, L5 near-duplicate lint, L6 supersession helper | |
| W13 | 28 Dec to 3 Jan | D2 induction, D3 replay gate, E2.11 trust floors | |
| W14 | 4 to 10 Jan | E1.6 tamper-evident log, L7 local NLI tier, X14 red-team harness | |
| W15 | 11 to 17 Jan | | E2.13 who can read, E8.11 inspector graph, table and diff, E9.8 import and export |
| W16 | 18 to 24 Jan | | E2.12 Cedar export |
| W17 | 25 to 31 Jan | | E8.12 verified actors, E8.13 OpenTelemetry export |
| W18 | 1 to 7 Feb | | E8.14 framework kit and AI SDK middleware |

Moved by the plan: B7 from W13 to W11, D1 from W17 to W11, D2 and D3 from W18 to W13. They need no key, and tau2-bench (B11) gives the replay gate its oracle before H5's runs. X11 (H5's runs) stays in W19.

Friday demonstrations the plan adds: W8, the counterexample tests' findings and a shrunk failing sequence from the stateful test; W9, a Python harness replayed through the proxy with zero new calls; W12, a write holding a secret denied with a reason that does not hold it; W13, the first admitted skill, five weeks earlier than planned; W14, `engram log verify` catching an edited row after an offboarding; W15, the provenance graph in the inspector.

### The second absorb plan in the week plan

Added on 2026-11-25 (`docs/tasks/absorb-plan-2.md`). Before the tag only test tooling merges; during H1's runs (1 to 8 December) only tests, specs, research scripts and new read-only commands; core changes, new configs and new MANIFEST rows resume after H1's `MERGE=4`. Card E2.21 (ADR 0034's grant cap; part 1, the tests, merged as #126 on 2026-11-27) builds its part 2 after `MERGE=4`, before E2.15.

| Week | Dates | Research lane | Product lane |
|---|---|---|---|
| W8 | 23 to 29 Nov | E0.6 register check, E0.7 determinism guards | |
| W9 | 30 Nov to 6 Dec | E8.16 surface parity and leaks, E1.8 Quint trace replay | E9.10 engram discover |
| W10 | 7 to 13 Dec | X16 gate mutation audit, X17 results page, E1.7 erasure gaps, E2.14 policy schema, E2.15 provenance across rewrites (after E2.21's part 2) | |
| W11 | 14 to 20 Dec | X18 fault-injection check, X19 erasure-residue check, E2.16 content-guard gaps, E1.9 chain coverage | E9.11 crypto-shredding ADR and keys |
| W12 | 21 to 27 Dec | L9 quote-grounding, D5 procedure safety scan, A6 MCP memory store, E2.17 why not this item | E9.12 do not record, E8.17 Codex hook |
| W13 | 28 Dec to 3 Jan | D4 drift and retirement, E2.18 Cedar symbolic proofs | E9.13 crypto-shredded erasure, E2.19 approval queue |
| W14 | 4 to 10 Jan | | E9.14 erasure receipt, E8.8 approvals on every surface |
| W15 | 11 to 17 Jan | | E2.20 policy test and diff, E9.15 signed audit report |
| W16 | 18 to 24 Jan | | E9.16 subject access export and Article 30 record |

Moved by the plan: D4 from W19 to W13, since D3 is merged; E8.8 from W8 to W14, after the approval queue it now shows.

### The gate work cards in the week plan

Added on 2026-11-25 (`docs/tasks/absorb-plan-2.md`, section 9, "Gate work cards (2026-11-25)"). They own the work the gates need that no card owned. The four pre-tag cards merge by 30 November, the day after W8 ends; the rest follow H1's `MERGE=4`.

| Week | Dates | Research lane | Product lane |
|---|---|---|---|
| W8 | 23 to 29 Nov | R5 audit configs drop (by 28 Nov), R6 OpenRouter endpoints (by 29 Nov), X21 capped utility count, then X20 refused answer call (both by 30 Nov, the day after W8 ends; the week does not move); H5P H5's prerequisites drafted for the lead (by 30 Nov) | |
| W10 | 7 to 13 Dec | X22 programme-wide spend cap (after `MERGE=4`, before any later live run) | |
| W11 | 14 to 20 Dec | X23 request-identity check, L10 contradiction prompt | |
| W13 | 28 Dec to 3 Jan | | E9.17 Knowledge dogfood kit; the members run it in W14 and W15 beside the twin dogfood |

## Task cards

Cards are grouped by epic. The dependency column is satisfied by earlier cards. Acceptance is a command the card creates; it must pass locally and in CI before the PR merges. Paste a card into a coding-agent session with the template at the end of this section.

### E0. Contracts and repository

| Card | Goal                                                                                                                                          | Depends | Files                                             | Acceptance                                                     |
|------|-----------------------------------------------------------------------------------------------------------------------------------------------|---------|---------------------------------------------------|----------------------------------------------------------------|
| E0.1 | Monorepo: uv workspace, pnpm workspace, Makefile, pre-commit (ruff, mypy, prettier), GitHub Actions CI                                        | none    | root, packages/\*/pyproject.toml                  | `make test` green in CI                                        |
| E0.2 | Schema as pydantic models (MemoryItem, MemoryEvent, Policy, Finding, Explanation) with schema_version; JSON Schema export; TS type generation | E0.1    | core/schema.py, core/schema/\*.json, ui/src/types | `make api` no diff on clean tree                               |
| E0.3 | Interfaces: StoreAdapter, Plane, Linter, Simulator, Distiller protocols with typed stubs and fakes                                            | E0.2    | core/interfaces.py, tests/fakes.py                | mypy passes; `tests/test_interfaces.py` instantiates fakes     |
| E0.4 | docker-compose: Postgres, server, UI; SQLite path for dev; `engram doctor`                                                                    | E0.1    | docker-compose.yml, server/settings.py            | `docker compose up` then `engram doctor` all green             |
| E0.5 | AGENTS.md with conventions; CLAUDE.md symlink; PR template with acceptance field                                                              | E0.1    | AGENTS.md, .github/                               | CI fails a PR without an acceptance command in the description |

### E1. Event log and item store

| Card | Goal                                                                                                | Depends | Files                       | Acceptance                                                        |
|------|-----------------------------------------------------------------------------------------------------|---------|-----------------------------|-------------------------------------------------------------------|
| E1.1 | Append-only event log with dense seq, actor, scopes, decision, reason; SQLite and Postgres backends | E0.3    | core/events.py, migrations/ | `tests/test_events.py`: append, query by item, by actor, by scope |
| E1.2 | Item metadata store (plane-owned fields) keyed by store_ref; version and lineage                    | E1.1    | core/items.py               | round trip; lineage walk returns ancestors                        |
| E1.3 | Replay-from-events: rebuild the item set at any seq from the event log alone                        | E1.2    | core/replay.py              | fixture workload: rebuilt set equals live set at every seq        |

### A. Adapters

| Card | Goal                                                                                                         | Depends | Files              | Acceptance                                                |
|------|--------------------------------------------------------------------------------------------------------------|---------|--------------------|-----------------------------------------------------------|
| A1   | Mem0 adapter (open-source Mem0, local vector store): put, get, search with scope filter via metadata, delete | E0.3    | adapters/mem0/     | conformance suite passes                                  |
| A2   | Letta adapter over its git-backed context files: items as files with frontmatter, search by index            | E0.3    | adapters/letta/    | conformance suite passes; a commit per write              |
| A3   | Files adapter: a folder of markdown (Claude Code memory layout) with frontmatter metadata                    | E0.3    | adapters/files/    | a team member's memory folder lists through `engram read` |
| A4   | Conformance suite: scope filtering, delete visibility, idempotent put, search recall on a fixture corpus     | A1      | tests/conformance/ | suite parametrized over adapters; Mem0 passes             |

### E2. Policy engine

| Card | Goal                                                                                                                        | Depends        | Files                                 | Acceptance                                                        |
|------|-----------------------------------------------------------------------------------------------------------------------------|----------------|---------------------------------------|-------------------------------------------------------------------|
| E2.1 | Policy loader and validator (YAML to Policy model), three bundled strictness presets                                        | E0.2           | core/policy/load.py, policies/\*.yaml | invalid policy rejected with a line number; presets load          |
| E2.2 | Read path: adapter search, scope matrix and grants filter, explanation object, read event                                   | E2.1, E1.1, A1 | core/plane/read.py                    | cross-scope read denied; explanation lists filtered-out count     |
| E2.3 | Write path: source and data-class checks, confidence floor, requires_review to candidate status, write event                | E2.1, E1.2, A1 | core/plane/write.py                   | forbidden class write denied on both stores with identical events |
| E2.4 | Retention: ttl expiry, scope budgets, recency and utility eviction, evict events                                            | E2.3           | core/plane/retention.py               | budget exceeded evicts per policy; events recorded                |
| E2.5 | Promotion: episodic to semantic after k confirmations or review; candidate skill to active after validation; promote events | E2.3           | core/plane/promote.py                 | fixture promotes only after k; review path records approver       |

### L. Lints

| Card | Goal                                                                                                                                        | Depends | Files                        | Acceptance                                            |
|------|---------------------------------------------------------------------------------------------------------------------------------------------|---------|------------------------------|-------------------------------------------------------|
| L1   | Deterministic lints: expired validity, source changed (hash), scope or class mismatch, missing provenance, orphaned source, exact duplicate | E1.2    | core/lints/det.py            | each lint has a positive and negative fixture         |
| L2   | Seeded-fault generator: inject stale, contradictory, misplaced and unsupported items into a benchmark memory state with labels              | L1, B5  | experiments/faults/          | results/faults_memory_v1.jsonl with counts per class  |
| L3   | Model-based lints: contradiction between active semantic items, unsupported claim relative to provenance; seeded, fixed model               | L1      | core/lints/model.py          | variance across three seeds reported on the pilot set |
| L4   | Lint evaluation: precision and recall by class, deterministic floor and model-based delta                                                   | L2, L3  | experiments/scripts/lints.py | results/lints.csv regenerated                         |

### B. Benchmark harnesses

| Card | Goal                                                                                       | Depends        | Files                  | Acceptance                                          |
|------|--------------------------------------------------------------------------------------------|----------------|------------------------|-----------------------------------------------------|
| B1   | Pin GateMem at a commit; vendor task files; run its reference agent                        | E0.1           | bench/gatemem/         | reference numbers within tolerance of the paper     |
| B2   | Pin MPBench; run its reference setup                                                       | E0.1           | bench/mpbench/         | reference numbers within tolerance                  |
| B3   | GateMem through the plane: principals map to scopes and grants; probes call read and write | B1, E2.2, E2.3 | bench/gatemem/plane.py | one probe runs under enforced condition with events |
| B4   | MPBench through the plane: write phase and retrieval phase cross the gate                  | B2, E2.3       | bench/mpbench/plane.py | one attack runs under enforced condition            |
| B5   | LongMemEval harness through the plane; category breakdown                                  | E2.2           | bench/longmemeval/     | ungoverned baseline on the primary model            |
| B6   | LongMemEval enforced baseline (preset medium)                                              | B5, E2.3       | bench/longmemeval/     | results/lme_baseline.csv                            |
| B7   | MERIT harness through the plane with cost accounting (rewritten 2026-11-21: through the cassette proxy) | E2.2, B10 | bench/merit/           | one task runs; cost recorded                        |
| B8   | HaluMem harness: per-operation error rate                                                  | E2.3           | bench/halumem/         | baseline table                                      |
| B9   | MemoryAgentBench forgetting split under retention presets                                  | E2.4           | bench/mab/             | results/forgetting.csv                              |

### X. Experiments

| Card | Goal                                                                                                                                                      | Depends      | Files                          | Acceptance                                         |
|------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|--------------------------------|----------------------------------------------------|
| R1   | Pre-registration: question, hypotheses, metrics, conditions, models, sample sizes with power, stopping rules, analysis plan                               | none         | experiments/PREREGISTRATION.md | committed and dated before X2                      |
| X1   | Condition runner: ungoverned, instruction-only (policy in prompt), enforced at a preset; seeds from config; caching                                       | B3, B4       | experiments/runner.py          | re-run with same config makes zero new model calls |
| X2   | H1 on GateMem, primary model, all conditions                                                                                                              | X1           | configs/h1_gatemem.yaml        | results/h1_gatemem.csv with binomial intervals     |
| X3   | H1 on MPBench, primary model                                                                                                                              | X1           | configs/h1_mpbench.yaml        | results/h1_mpbench.csv                             |
| X4   | H1 analysis: paired bootstrap, effect sizes, Holm; figure                                                                                                 | X2, X3       | scripts/h1_analysis.py         | results/h1.png and table                           |
| X5   | Frontier design: three presets, retention budgets, scope widths; config matrix                                                                            | X4, E2.4     | configs/frontier/\*.yaml       | matrix validated; cost estimate committed          |
| X6   | Frontier run, primary model, Mem0 and Letta, GateMem and LongMemEval                                                                                      | X5, A2       | scripts/frontier.py            | results/frontier_local.csv                         |
| X7   | Frontier run, second provider, subset plus MERIT                                                                                                          | X6, B7       | configs/frontier/hosted1.yaml  | results/frontier_hosted1.csv                       |
| X8   | Frontier run, third provider; optional seeded open-weights arm for bit-exact reproduction if the lab can serve one                                        | X7           | configs/frontier/hosted2.yaml  | results/frontier_hosted2.csv                       |
| X9   | H2 and H4 analysis: knee detection, cross-model violation equivalence on GateMem (ADR 0035; the store family left H4), utility gap; frontier figure      | X6, X7, X8   | scripts/frontier_analysis.py   | results/frontier.png                               |
| X10  | H3 recovery: enforced plus lints at matched budget on LongMemEval and HaluMem                                                                             | L4, B8       | scripts/recovery.py            | results/recovery.csv                               |
| X11  | H5: tau2 and repository tasks with and without admitted skills; steps, success, violations                                                                | D3           | scripts/h5.py                  | results/h5.csv                                     |
| X12  | Failure analysis: five worked examples per hypothesis where the method or the plane is wrong                                                              | X9, X10, X11 | docs/failure-analysis.md       | reviewed by two members                            |
| X13  | Reproduction script: fresh clone regenerates every table and figure from committed caches; live re-runs are optional and skip cleanly without credentials | all X        | experiments/reproduce.sh       | runs clean on a fresh machine                      |

### D. Procedural module

| Card | Goal                                                                                                                                                   | Depends  | Files                  | Acceptance                                                        |
|------|--------------------------------------------------------------------------------------------------------------------------------------------------------|----------|------------------------|-------------------------------------------------------------------|
| D1   | Session recorder for tau2 tasks and a repository task set; sessions stored as episodic items                                                           | E2.3     | procedures/record.py   | fifty sessions recorded with task ids                             |
| D2   | Induction using a published method (Agent Workflow Memory or Trace2Skill, cited); candidates as procedural items with SKILL.md body and tool allowlist | D1       | procedures/induce.py   | candidates produced for a fixture session set                     |
| D3   | Replay validation gate: re-run originating tasks with the candidate installed; admit at or above threshold via promote                                 | D2, E2.5, B11 | procedures/validate.py | a failing candidate stays candidate; a passing one becomes active |
| D4   | Drift detection: periodic re-validation; retire below threshold (kill list item 1) (rewritten 2026-11-25: on D3's replay rule, opt-in)                                                                     | D3       | procedures/drift.py    | fixture with a changed task retires the skill                     |

### E8. Surfaces

| Card  | Goal                                                                                         | Depends    | Files                     | Acceptance                                             |
|-------|----------------------------------------------------------------------------------------------|------------|---------------------------|--------------------------------------------------------|
| E8.1  | FastAPI app: items, events, policy, lint, simulate, distill, explain; OpenAPI export         | E0.3       | server/app.py             | contract tests hit every route                         |
| E8.2  | CLI: write, read, lint, simulate, promote, explain, serve, doctor                            | E8.3       | sdk/cli.py                | each command one client call; help snapshot test       |
| E8.3  | Generated Python and TypeScript clients from OpenAPI                                         | E8.1       | sdk/client.py, ui/src/api | `make api` clean                                       |
| E8.4  | MCP server (streamable HTTP and stdio) exposing the same operations                          | E8.3       | server/mcp/               | MCP client runs explain on a fixture read              |
| E8.5  | Inspector v0: scope lanes, timeline                                                          | E8.3       | ui/                       | Playwright opens a fixture workspace                   |
| E8.6  | Explain view: for a read, which items were returned, which were filtered and by which rule   | E2.2, E8.5 | ui/                       | Playwright asserts filtered count matches event        |
| E8.7  | Findings view for lints with resolve actions (retire, edit scope, add provenance)            | L1, E8.5   | ui/                       | resolving a finding writes an event                    |
| E8.8  | Review queue for candidates and promotions (rewritten 2026-11-25: E2.19's approvals on every surface) | E2.5, E8.5 | ui/                       | approve promotes; reject retires                       |
| E8.9  | Simulator CLI: replay a recorded workload under a policy; report utility proxy and evictions | E1.3, E2.4 | core/simulate.py          | fixture workload under two presets prints a comparison |
| E8.10 | Diff view between two snapshots of a scope                                                   | E1.3, E8.5 | ui/                       | Playwright asserts added, removed, changed counts      |

### E9. Profiles and dogfood

| Card | Goal                                                                                                             | Depends    | Files                   | Acceptance                                                                  |
|------|------------------------------------------------------------------------------------------------------------------|------------|-------------------------|-----------------------------------------------------------------------------|
| E9.1 | Knowledge profile policy: provenance required for org, validity required, conflict lint on, review for promotion | E2.1       | profiles/knowledge.yaml | loads; fixture writes behave per policy                                     |
| E9.2 | Twin profile policy: person and role scopes, default grants, offboarding rule set                                | E2.1       | profiles/twin.yaml      | loads; cross-person read denied in fixture                                  |
| E9.3 | Knowledge screens: source lineage panel, conflict resolution                                                     | E9.1, E8.7 | ui/                     | Playwright: lineage from source to item to read                             |
| E9.4 | Twin screens: grants editor, person versus role lanes                                                            | E9.2, E8.5 | ui/                     | grant change recorded as an event                                           |
| E9.5 | Twin dogfood: each member runs a twin over the files adapter for two weeks; violation report                     | E9.4, A3   | docs/dogfood.md         | report shows reads, grants, zero violations                                 |
| E9.6 | Procedures screens: candidate queue with validation scores                                                       | D3, E8.8   | ui/                     | admit from the UI writes a promote event                                    |
| E9.7 | Offboarding: hand role scope to a successor, delete person scope, emit a deletion report (kill list item 2)      | E9.2, E1.3 | core/plane/offboard.py  | fixture: successor reads role items; person items gone from store and index |

### The absorb plan, 2026-11-21

Twenty-six cards added by `docs/tasks/absorb-plan.md`, which also rewrote cards B7, D1, D2 and D3 above. Each card file holds the full steps, the sources it absorbs with their licences (ADR 0037), and its decision if it waits on one. The Files column names each card's main path in the TypeScript layout (the tables above keep roadmap v1's shorthand); the card files give the full list.

| Card  | Goal                                                                                                                                                   | Depends         | Files                                              | Acceptance                                |
|-------|--------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------|----------------------------------------------------|-------------------------------------------|
| R2    | Pre-registration: every arm the absorb plan would run, written as a proposal; nothing registered                                                       | answers card    | docs/research/preregistration.md                   | `make lint-docs`; `test_prereg.py`        |
| R3    | The novelty claim restated against HEAMS and SAFE-Mem                                                                                                  | none            | docs/research/positioning.md, README.md            | `make lint-docs`                          |
| R4    | Claims to tests to obligations: a crosswalk file and the script that checks every named test exists                                                    | none            | research/scripts/crosswalk.py, docs/compliance/    | `make test-repro` row                     |
| E1.4  | A stateful model-based test of the Plane (fast-check commands) and crash-window tests with a test-side failpoint                                       | none            | packages/core/test/property/stateful.test.ts       | `make test-invariants`                    |
| E1.5  | A Quint model of the commit and erasure protocol, with a broken variant the checker must refute                                                        | none            | specs/commit.qnt                                   | `make verify-spec`                        |
| E1.6  | Tamper-evident event log that keeps erasure possible: side-table chain, signed checkpoints, `engram log verify`                                        | none            | packages/core/src/log/chain.ts                     | chain invariant on SQLite and Postgres    |
| A5    | Conformance cases for validity, history and graph claims; a revocation grid per store; ADR 0013 amended for Mem0 version 3                             | A4              | packages/adapters/test/conformance/                | `make test`                               |
| E2.7  | Counterexample tests for the two suspected trust gaps, as characterisation tests                                                                          | none            | packages/core/test/counterexamples/                | the test file runs; `make test` green     |
| E2.8  | Schema-only: the policy's content guards and trust options, all off by default                                                                         | none            | packages/core/src/schema.ts                        | `make api-check`                          |
| E2.9  | Secret and personal-data guard at the write gate: deny or hold, the reason never holds the value                                                       | E2.8            | packages/core/src/policy/secrets.ts                | unit tests; false-positive result         |
| E2.10 | Deterministic injection screen for content a person did not type; reported as a floor with both error rates                                            | E2.8            | packages/core/src/policy/injection-screen.ts       | a test per rule; corpus result            |
| E2.11 | Trust floors: unattested writes land at the least trusted kind; a less trusted source never changes or evicts a more trusted item; opt-in; invariant 8 | E2.7, E2.8      | packages/core/src/plane/write.ts, policy/          | `make test-invariants`                    |
| E2.12 | Policy exported to Cedar, with a differential property test against the evaluator                                                                      | none            | packages/core/src/policy/cedar.ts                  | the property test                         |
| E2.13 | Who can read this memory: a symbolic reader set with reasons, in core, the CLI and the inspector                                                       | E9.4            | packages/core/src/plane/who-can-read.ts            | equals brute-force enumeration            |
| L5    | Near-duplicate lint: MinHash candidates and an IDF-veto precision tier; byte-identical when unset                                                      | L1, L4          | packages/core/src/lint/det.ts                      | `make test`; hashes unchanged             |
| L6    | Supersession helper: proposes end dates and review flags; a cycle-safe head resolver; never retires by itself                                          | none            | packages/core/src/supersede.ts                     | property test                             |
| L7    | Local NLI tier for the contradiction lint: injected scorer, cached scores, only the uncertain band reaches the model                                   | R2, L3          | packages/core/src/lint/, packages/model/src/nli.ts | replayed run, zero new scores             |
| L8    | Lint reads through the read filter: findings name or describe only what `evaluateRead` admits; the registered H3 call sites keep their reach          | L1, L3, L6      | packages/core/src/plane/lint.ts, packages/core/src/lint/ | packages/core/test/unit/plane/lint-read-filter.test.ts, packages/core/test/property/lint-read-filter.test.ts, make test-invariants |
| B10   | Cassette proxy in @engram/model: outside harnesses reach models only through the cached, seeded call (ADR 0036)                                        | none            | packages/model/src/proxy.ts                        | a miss is an error; second run zero calls |
| B11   | tau2-bench through the plane and the proxy, as an external process at its pin                                                                          | B10             | packages/bench/src/tau2/                           | slice replayed with zero new calls        |
| X14   | Red-team harness: AMSB scenarios and pinned payload sets against write and read, with benign controls                                                  | R2, E2.9, E2.10 | packages/bench/src/redteam/                        | `make redteam` offline                    |
| X15   | Plane overhead: latency percentiles and query counts against bare SQLite, as a result and a budget                                                     | none            | packages/core/bench/                               | `make test-repro` row                     |
| E8.11 | Inspector: provenance graph, virtualised event table, version diff, with a leak test                                                                   | E8.5            | packages/ui/src/                                   | `make test-e2e`                           |
| E8.12 | Verified actors: bearer tokens and hashed API keys on the HTTP surfaces; ADR first                                                                     | none            | packages/server/src/, packages/mcp/src/            | every event's actor authenticated         |
| E8.13 | Decisions exported as OpenTelemetry spans, off by default, never carrying content                                                                      | none            | packages/core/src/export/otel.ts                   | content-free mapping test                 |
| E8.14 | Framework kit (by-id read, scope list) and a Vercel AI SDK middleware                                                                                  | none            | packages/kit/, packages/ai-sdk/                    | `make api-check`; adapter conformance     |
| E8.15 | The engram terminal interface (`engram tui`): every command and flag reachable, each action its plain command's client call; design and ADR 0044 first | E9.8, E2.13, E8.12, E8.14 | packages/cli/src/tui/, packages/cli/src/registry.ts | `make test-one T=packages/cli/test/tui/parity.test.ts` |
| E9.8  | Memory import and export: a portable bundle; imports are governed candidate writes                                                                     | none            | packages/cli/src/import/                           | round-trip test                           |
| E9.9  | An owner accepts a candidate in their own person scope, as user, its trust unchanged; ADR 0049 amends ADR 0026                                         | E2.5, E2.10, E9.8 | packages/core/src/policy/promotion.ts            | `make test-one T=packages/core/test/unit/plane/owner-accepts.test.ts` |

### The second absorb plan, 2026-11-25

Twenty-eight cards added by `docs/tasks/absorb-plan-2.md`, which also rewrote cards D4 and E8.8 above. Each card file holds the steps, the sources with their licences and commits, and its guard.

| Card  | Goal | Depends | Files | Acceptance |
|-------|------|---------|-------|------------|
| E0.6  | `make lint-docs` checks the absorbed register: paths, licences, notices | none | scripts/check-absorbed.ts | the check's test; `make lint-docs` |
| E0.7  | Determinism guards: no network in tests, no clock or randomness in core | none | vitest.shared.ts, scripts/test/ | the rule's test |
| E8.16 | Cross-surface parity and leak suite over CLI, HTTP, MCP and pi | RD1 | packages/*/test/leakage, parity | the suites; `make test-e2e` |
| E1.8  | Quint traces replayed against the Plane | none | packages/core/test/model/ | `make verify-spec` |
| X16   | Gate mutation audit: frozen mutants, each with the test that kills it | none | research/scripts/gate_mutation_audit.py | `make test-repro` row |
| E9.10 | `engram discover`: harness memory outside the plane, counted; a doctor warning | none | packages/core/src/discover.ts | classifier test |
| X17   | The results page: every MANIFEST row with its hash and command | none | research/scripts/results_page.py | `make test-repro` row |
| E1.7  | Erasure: close the two gaps the Quint model found | E1.8 | packages/core/src/plane/offboard.ts | `make verify-spec`; invariants |
| E2.14 | Policy schema: this plan's options and E2.21's `grants.expiry_cap`, absent meaning today's behaviour, no version bump | none | packages/core/src/schema.ts | `make api-check` |
| E2.15 | Provenance holds across rewrites, closes and imports | E2.21 | packages/core/src/plane/write.ts | `make test-invariants` |
| X18   | The paired fault-injection check for H3 (proposal U6) | none | research/scripts/h3_fault_injection.py | `make test-repro` row |
| X19   | The erasure-residue check (proposal U7) | E1.7 | research/scripts/h3_erasure_residue.py | `make test-repro` row |
| E2.16 | The content guards: ref scan, keyed hashes, word-based names, the oracle | none | packages/core/src/policy/secrets.ts | `make test-invariants` |
| E1.9  | The chain on every writer and over attestations; race-free migration | none | packages/core/src/log/chain.ts | chain invariant on both backends |
| L9    | Quote-grounding for the model lints, opt-in | E2.14 | packages/core/src/lint/evidence.ts | replayed fixture run |
| D5    | The procedure safety scan at admission | E2.14 | packages/core/src/lint/procedural.ts | a test per class; corpus |
| A6    | A fourth store: the MCP reference memory server's JSONL file | none | packages/adapters/src/mcp-memory/ | conformance suite |
| E2.17 | Why not this item: the first stage that excluded it | RD1 | packages/core/src/plane/explain-absent.ts | property and leak tests |
| E2.18 | Preset properties proved by Cedar's symbolic compiler | none | tools/symcc/ | `make verify-policy` |
| E9.11 | Crypto-shredded erasure: the ADR and the key side table | E1.7 | packages/core/src/crypto/keys.ts | migration on both backends |
| E9.12 | Do not record: consent at the write gate | E2.14 | packages/core/src/policy/consent.ts | property test |
| E8.17 | Codex under the gate: PreToolUse hook and idempotent installer | none | packages/mcp/src/hook.ts | `make test-e2e` |
| E9.13 | Crypto-shredded erasure in offboarding | E9.11, X19 | packages/core/src/crypto/seal.ts | invariants; residue rerun |
| E2.19 | The approval queue: routed approvers, expiry, no self-approval | E2.14, E9.9 | packages/core/src/plane/approvals.ts | its property test; `make test-invariants` |
| E9.14 | The signed erasure receipt, with residue verification | E9.13 | packages/core/src/receipt.ts | tamper tests |
| E2.20 | Policy as code: `engram policy test` and `policy diff` | none | packages/core/src/policy/cases.ts | `make api-check` |
| E9.15 | The signed audit report (DSSE, in-toto) | none | packages/core/src/audit/ | verify and tamper tests |
| E9.16 | The subject access export and the Article 30 record | none | packages/core/src/audit/ropa.ts | round-trip test |

### Gate work cards, 2026-11-25

Eight cards for the gate work no card owned (`docs/tasks/absorb-plan-2.md`, section 9), and card H5P, the last row: H5's prerequisites (lead-decisions item 30), drafted apart as a proposed amendment, registered only by the lead.

| Card  | Goal | Depends | Files | Acceptance |
|-------|------|---------|-------|------------|
| R5    | Both audit configs read `on_stop: drop`; the two draw records regenerated, draws unchanged (pre-tag condition 2) | none | research/configs/label-audit*.json | label-audit tests; `make test-repro` |
| R6    | Each live config pins its OpenRouter endpoints from a dated snapshot (pre-tag condition 5) | none | research/configs/openrouter-endpoints.json | `make test-one T=packages/runner/test/rv6-endpoints.test.ts` |
| X20   | A refused answer call is an exclusion; a 401, 402 or 403 stops the run (pre-tag condition 3, item 14) | none | packages/runner/src/model/cassette.ts | `make test-one T=packages/runner/test/answer-refusal.test.ts` |
| X21   | The H1 table counts the utility sessions the turn limit capped (pre-tag condition 3, item 15) | none | research/analysis/h1.py | H1 exclusion tests |
| X22   | The runner enforces the programme-wide spend cap in billed dollars (pre-tag condition 7, after H1) | X20, H1's `MERGE=4` | packages/runner/src/spend-cap.ts | `make test-one T=packages/runner/test/spend-cap.test.ts` |
| X23   | The request-identity check on files, Mem0 and Letta, a rule-9 result (ADR 0035) | H1's `MERGE=4` | research/scripts/h4_request_identity.py | `make test-one T=packages/runner/test/request-identity.test.ts`; `make test-repro` row |
| L10   | The contradiction prompt counts a later update of the same attribute (item 44) | R6, H1's `MERGE=4` | packages/core/src/lint/model.ts | `make test-one T=packages/core/test/unit/lint/model.test.ts`; `make test-repro` |
| E9.17 | The Knowledge profile's dogfood beside the twin dogfood (item 28) | E9.5 | docs/dogfood.md | `make test-one T=packages/core/test/unit/dogfood-knowledge.test.ts` |
| H5P   | H5's prerequisites drafted as a proposed amendment for the lead, nothing registered (item 30) | none | docs/research/preregistration.md, proposed section only | `make lint-docs`; `uv run pytest research/tests/test_prereg.py` |

### Card prompt template

    You are implementing task card {ID} in the Engram repository. Read AGENTS.md first.
    Goal: {goal}
    Files you may touch: {files}
    Depends on (already merged): {depends}
    Acceptance: run `{acceptance}`; it must pass. Do not modify the acceptance test.
    Out of scope: anything in another package; schema changes unless the card says so.
    Start by proposing a plan. Keep the diff under 400 lines. Add tests for new core functions.

## Dependency map

The critical path to the first result is `E0.2 → E0.3 → E1.1 → E1.2 → A1 → E2.2 and E2.3 → B3 and B4 → X1 → X2 and X3 → X4`. Everything on it is on the research track and is scheduled with slack of at least one week before Gate C. The product track joins the critical path only at Gate D, through E9.5's violation report.

| If this slips                          | Then this waits                     | Slack   | Mitigation                                                                           |
|----------------------------------------|-------------------------------------|---------|--------------------------------------------------------------------------------------|
| A1 Mem0 adapter                        | E2.2, E2.3, B3, B4, everything in X | 1 week  | Files adapter stands in for Mem0 until A1 lands; policy tests run on files           |
| A2 Letta adapter                       | X6 (two-store frontier), H4         | 5 weeks | Gate B response: files plus Mem0 as the two paradigms                                |
| B1 or B2 pins                          | B3, B4, X1                          | 3 weeks | Vendor task files; if a harness breaks, re-implement the probe format from the paper |
| Primary provider access or rate limits | X2 onward                           | 2 weeks | Second provider becomes primary; caching makes the swap a config change              |
| L3 model-based lints                   | L4, X10                             | 2 weeks | Deterministic lints alone for H3; model-based reported as pilot                      |
| D2 induction                           | D3, X11, H5                         | 1 week  | Use the simplest published method; H5 on tau2 only                                   |
| Hosted model access                    | X7, X8                              | none    | Report frontier on local plus one hosted; state as limitation                        |
| B10 cassette proxy                     | B7, B11, D3, X7 (MERIT), X11        | 2 weeks | Nothing to absorb, so it is built first; MERIT and tau2 are run offline only until it lands |
| B11 tau2 spike                         | D3's oracle, X11, H5                | 2 weeks | If tau2 cannot be routed through the proxy unmodified, H5 runs on the repository task set and the limit is stated |
| E2.8 policy schema PR                  | E2.9, E2.10, E2.11, X14             | 1 week  | It is small and schema-only (ADRs 0039 and 0040 are accepted); the guards are built behind it on a branch |
| The arms' registration (R2)            | L7, X14 results entering the thesis | none    | The engineering lands and runs offline; the numbers stay out of the thesis until registered |

## Effort budget

Four members at about 16 hours per week for 26 weeks, roughly 52 full-time-equivalent weeks in total, of which about 44 are plannable after holidays and exams. Estimates below assume coding-agent leverage on boilerplate at about half the hand-written cost, and none on experiment design, statistics, annotation or writing. Re-estimate at Gate B from actual card completion times.

| Workstream               | Cards         | FTE-weeks | Owner                |
|--------------------------|---------------|-----------|----------------------|
| Contracts and schema     | E0.1 to E0.5  | 2.0       | Lead, B              |
| Event log and items      | E1.1 to E1.3  | 2.5       | Lead                 |
| Adapters and conformance | A1 to A4      | 4.0       | A                    |
| Policy engine            | E2.1 to E2.5  | 4.0       | Lead, C              |
| Lints and seeded faults  | L1 to L4      | 3.5       | C                    |
| Benchmark harnesses      | B1 to B9      | 5.0       | A                    |
| Experiments and analysis | R1, X1 to X13 | 9.0       | Lead, A, C           |
| Procedural module        | D1 to D4      | 3.0       | C                    |
| Surfaces                 | E8.1 to E8.10 | 5.0       | B                    |
| Profiles and dogfood     | E9.1 to E9.7  | 3.0       | B                    |
| Writing, paper, defense  | n/a           | 5.0       | All, Lead integrates |
| **Total**                |               | **46.0**  |                      |

Gap of about two FTE-weeks against 44 plannable. Kill list items 1 and 2 (D4 and E9.7) are worth about 1.5 together; item 3 (B9) is 0.5. The base case closes the gap without touching anything the thesis needs.

**The absorb plan's cost (2026-11-21).** At this budget's rates (a small card 0.25, a medium 0.5, a large 1.0 FTE-week) the thirty pull requests come to 16.5 FTE-weeks: 12.5 on the research lane (cards 1 to 23 of `docs/tasks/absorb-plan.md`) and 4.0 on the product lane (cards 24 to 30). Cards B7 and D1 to D3 are already in the table above (about 3.0), so the net addition is about 13.5.

| Absorb plan stage | Cards | FTE-weeks |
|---|---|---|
| Before the tag (W8) | R2, R3, E2.7, A5, E1.4 | 1.5 |
| Research spine (W9 to W14) | B10, X15, R4, E1.5, B7, B11, D1, E2.8, E2.9, E2.10, L5, L6, D2, D3, E2.11, E1.6, L7, X14 | 11.0 |
| Product lane (W15 to W18) | E2.13, E8.11, E9.8, E2.12, E8.12, E8.13, E8.14 | 4.0 |
| **Total** | 30 | **16.5** |

The table above has no room for that at its original rates. The plan rests on the pace observed so far, not on the estimate: by 21 November, the end of W7, the engineering of cards the week plan places in W11 to W15 is merged (E2.4, E8.9, L2, L3, L4, E9.4), with E9.7 from the kill list. That pace is not measured in FTE-weeks anywhere, so it is an observation and not a rate. Re-estimate at Gate C from the absorb cards merged by then; if fewer than seven of the nine cards placed before Gate C are merged, the product lane is cut first, in the order the kill list gives.

**The second absorb plan's cost (2026-11-25).** At the same rates the thirty come to 15.0 FTE-weeks: 8.5 on the research lane and 6.5 on the product lane; D4 and E8.8 were already counted in the tables above (about 1.0). As with the first plan, the estimate rests on the observed pace. If H1, H2 or H3 need the team, the second plan's product lane is cut first, last card first (E9.16, E9.15, E2.20, E8.8, E9.14, E2.19, E9.13, E8.17, E9.12, E9.11, E9.10), then its research lane in the same order; E0.6, E0.7, E1.7 and E2.15 are never cut, since they guard rule 16, determinism, erasure and Gate D's dogfood.

## Compute and data budget

- **Models.** Three hosted models from different providers, fixed in the pre-registration: M1 DeepSeek v4 pro, M2 GLM 5.3 Flash, M3 Mistral Large 4, all through OpenRouter (the lead's choice, 2026-11-20). The primary carries every sweep (X2, X3, X6, X10, X11, lint evaluation); the second and third run a fixed subset per benchmark (about 100 GateMem probes, 100 MPBench attacks, 200 LongMemEval questions, 50 MERIT tasks, at three conditions and two presets). Order of magnitude: low thousands of dollars across all three with caching (1,159 to 5,227 dollars for every registered run as decided, `research/results/h2-cost-table.json`); each run's ceiling is 1.25 times its high estimate, per provider, in the ledger dollars the runner meters at pi-ai's catalogue prices (item 3), and a programme-wide cap equal to the API credit held, in billed dollars, bounds them all (item 59; the pre-registration's Models section).
- **Optional seeded arm.** If the lab can serve an open-weights model, one seeded run of X2 and X6 gives bit-exact reproduction. It is an addition to the protocol, never a dependency; no card blocks on it.
- **Caching.** Every model call keyed on (benchmark item, condition, preset, store, seed). A re-run with the same config makes zero new calls. This is X1's acceptance test and the single largest cost control.
- **Data.** Benchmark data from pinned upstream commits, vendored. Seeded faults generated by L2 from benchmark memory states. Dogfood data stays on members' machines; only aggregate violation counts enter the repository.
- **Storage.** Event logs and caches committed as compressed fixtures for the local-model runs so X13 works offline. The hosted runs' cassettes, about 0.9 to 2 GB for H1, are deposited on Zenodo with a fetch script that checks each by sha256, so reviewers can regenerate tables without credentials (item 27, ADR 0036).

## Conventions and definition of done

    # AGENTS.md (also CLAUDE.md)

    ## What this is
    Engram governs what agents remember: a control plane above memory stores.
    Part I of the thesis depends on packages/core, adapters/, bench/ and experiments/. Treat those as load-bearing.

    ## Commands
    uv sync && pnpm install      # once
    make test                    # unit, conformance on fakes, replay-from-events
    make api                     # regenerate OpenAPI and both clients after any route change
    make bench BENCH=gatemem     # run one harness on the fixture subset
    engram doctor                # db, adapters, provider keys, benchmark pins

    ## Rules
    1. Logic lives in packages/core and adapters/. Surfaces (cli, mcp, ui) only call the client.
    2. Schema changes: edit schema.py, bump schema_version, migration, make api, fixtures. One PR.
    3. Reads and writes to any store go through Plane.read and Plane.write. Never call an adapter directly outside tests.
    4. Every policy decision emits an event with a reason and policy_id. A decision without an event is a bug.
    5. Every sampled model call takes a seed from the experiment config. No unseeded randomness in bench/ or experiments/.
    6. No result is real unless experiments/scripts/<name>.py regenerates it from configs/ into results/.
    7. Benchmark harnesses are pinned to a commit in bench/PINS.md. Never update a pin mid-experiment.
    8. PRs under 400 changed lines. One card per PR. Title = card id + goal.
    9. New dependency = one line in docs/deps.md with reason and license.
    10. Dogfood content never leaves the member's machine; only aggregates are committed.

    ## Definition of done for a card
    - acceptance command passes locally and in CI
    - make test passes
    - an event log excerpt or fixture demonstrating the change is in the PR description
    - AGENTS.md updated if a rule or command changed

**Cadence.** Monday: cards assigned for the week, dependencies checked. Wednesday: thirty-minute unblock. Friday: demo from a recorded workload or a results table; nothing merges without one. Supervisor check-ins at each gate plus week 23 for the full draft.

**Disclosure.** The methods chapter states that implementation used coding agents under these conventions, that experiment code and analysis were hand-reviewed, and that every generated component carries tests.

## Writing schedule

| Chapter                                         | Draft by | Depends on                 | Owner   |
|-------------------------------------------------|----------|----------------------------|---------|
| 3\. The Engram plane                            | W19      | Gate B artifacts           | Lead    |
| 4\. Enforcement versus instruction              | W19      | X4                         | Lead    |
| 5\. The governance frontier                     | W20      | X9                         | Lead, A |
| 6\. Lints and recovery                          | W20      | X10, L4                    | C       |
| 7\. Governed procedural memory                  | W21      | X11                        | C       |
| 8\. Applications and dogfood                    | W21      | E9.5                       | B       |
| 2\. Related work                                | W22      | gap table                  | A       |
| 1, 9, 10. Introduction, limitations, conclusion | W23      | all                        | Lead    |
| Workshop paper (chapters 4 to 6 compressed)     | W24      | supervisor pass            | Lead    |
| Defense deck                                    | W24      | inspector screens, figures | B       |

## Risk triggers and the kill list

| Risk                                  | Trigger            | Pre-decided response                                                       |
|---------------------------------------|--------------------|----------------------------------------------------------------------------|
| Enforcement does not beat instruction | Gate C             | Pivot to failure characterisation; keep plane; reallocate X7 and X8 to X12 |
| Letta adapter unstable                | Gate B             | Files plus Mem0 as the two paradigms; limitation stated                    |
| Benchmark harness churn               | Any upstream break | Pins and vendored task files; re-implement probe format if needed          |
| Model-based lint variance above bound (a standard deviation across seeds above 0.05 on precision or recall, for any lint; item 43) | L3 pilot | The deterministic tier becomes H3's primary test and the model tier is reported as secondary, a rule registered before any pilot data (item 58, the lead's answer of 2026-11-21) |
| API spend hits ceiling                | During X6 to X8    | Stop; report the completed subset; the primary model carries the frontier  |
| A run reaches its own ceiling (1.25 times its high estimate in ledger dollars; item 3) or the programme-wide cap (the API credit held; item 59) | Any live run | H1 pauses and is never reported as a completed subset: the lead decides whether to raise the ceiling and resume with `RESUME=1`. A run that would cross the programme cap, in billed dollars, pauses, and the lead decides whether to resume; until the runner checks the cap, the operator reads OpenRouter's credit balance at least every two hours and stops every shard below one session's cost per running shard plus 10 percent |
| Member unavailable two weeks          | Any time           | Owner column reassigns; kill list in order                                 |
| Name collision                        | W1 check           | Fallbacks: Trace, Keep                                                     |

### Kill list, in order

1.  E9.7 twin offboarding automation (keep the scope split)
2.  B9 MemoryAgentBench forgetting split
3.  E8.9 simulator beyond the CLI
4.  E8.10 diff view and inspector polish
5.  D4 procedural drift detection (keep admission by replay). Last, because Distill is a core sell.

**The kill list's rewrite, proposed for the lead** (item 26; drafted by the answers card of 2026-11-21, not yet in force). Items 1 (E9.7) and 3 (E8.9) are done, as item 26 records, and item 2 (B9) is no longer what H4 needs, since H4 runs on GateMem only (item 24). Proposed, in order: 1. B9 MemoryAgentBench forgetting split; 2. E8.10 diff view and inspector polish; 3. D4 procedural drift detection (keep admission by replay), last for the reason above. Gate D's fail response stays "items 1 and 2, then 3" over the new numbering. Gate C's undecided branch cuts nothing: the programme continues as planned (item 10).

**Never cut:** E0, E1, A1, A3, A4, E2.1 to E2.3, E2.5, L1, L2, L4, B1 to B6, D1 to D3, R1, X1 to X6, X9, X10, X11, X13. From the absorb plan: R2, R3, E2.7, A5, E1.4, B10 and B11 (H5 cannot run without the last two).

**The absorb plan's cut order** (2026-11-21), applied before the list above is touched, last card first: E8.14, E8.13, E8.12, E2.12, E9.8, E8.11, E2.13 (the product lane), then L7, E1.5, X15, R4, L6, L5, X14, E1.6. The content guards (E2.8 to E2.10) and the trust floors (E2.11) are cut only together with X14, since a guard that is not measured is not reported.

## Appendix: deferred items

Out of scope for the degree, listed so they are not forgotten when the company starts.

- **Legal and consent design for workplace twins.** Deferred by decision. The scope split and grants exist as mechanisms; the policy work (what an employer may grant itself, deletion proofs, regional rules) is the first post-degree workstream.
- **Third and fourth adapters.** Zep via Graphiti, LangGraph Store, Redis Agent Memory Server. Engineering against the conformance suite.
- **Enterprise features.** SSO, retention proofs, on-premises deployment, key custody for signed event logs.
- **Procedural memory beyond the gate.** Co-evolution of skills with the policy, as the literature now does; adopt rather than invent.
- **Harness-native plugins.** A Claude Code plugin and a Codex configuration that route memory reads and writes through the plane by default, reusing the Inquest adapter work.

Prepared 2 October 2026. Companion: the Engram proposal, which holds the gap analysis, hypotheses, evaluation protocol and sources.

