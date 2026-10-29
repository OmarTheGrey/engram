# Engram roadmap

> **Status: living document, subject to change.** This roadmap is the plan as of its date. Phases, cards, estimates, tooling and ordering will change if the team decides to, or finds a better approach. Known deltas since v1: the plane is built on pi (ADR 0001), so cards E0.1, E0.3, E8.1 and E8.3 are to be rewritten and cards PX1 to PX3 and RN1 to RN2 added (see `docs/decisions/README.md` and `docs/tasks/step-0.md`). Decisions that change this document are recorded as ADRs and entries under `docs/log/`. The repository copy is the current version; exported HTML and PDF are snapshots.

Twenty-six weeks, two tracks, four gates, sixty-one task cards, one script that regenerates every table.

Dates assume a start on Monday 5 October 2026 and submission in the last week of March 2027. If the department's calendar differs, the week numbers hold and the dates shift.

**Status: living document, subject to change.** This roadmap is the plan as of its date. Phases, cards, estimates, tooling and ordering will change if the team decides to, or finds a better approach. Known deltas since v1: the plane is built on pi (ADR 0001), so cards E0.1, E0.3, E8.1 and E8.3 are to be rewritten and cards PX1 to PX3 and RN1 to RN2 added (see docs/decisions/README.md and docs/tasks/step-0.md). Decisions that change this document are recorded as ADRs and log entries, and the current version always lives in the repository.

1.  [Planning principles](#principles)
2.  [Phases and gates](#phases)
3.  [Timeline at a glance](#gantt)
4.  [Week by week](#weeks)
5.  [Task cards](#cards)
6.  [Dependency map](#deps)
7.  [Effort budget](#effort)
8.  [Compute and data budget](#compute)
9.  [Conventions and definition of done](#conventions)
10. [Writing schedule](#writing)
11. [Risk triggers and the kill list](#risks)
12. [Appendix: deferred items](#appendix)

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

**Gate C, end of week 10.** Pass if: H1 table exists on the primary model with intervals, for ungoverned, instruction-only and enforced conditions, on GateMem and MPBench. Decision: if enforcement beats instruction, continue as planned; if it does not, pivot the thesis to characterising where boundary enforcement fails and why, keep the plane, and reallocate phase 3's hosted sweeps to failure analysis.

**Gate D, end of week 16.** Pass if: the frontier figure exists for at least two policy levels on two stores and two models; seeded-fault lint precision and recall are tabulated; Knowledge and Twin profiles run on dogfood data with zero recorded violations. Fail response: kill list items 1 and 2, then 3.

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

R: X7 frontier run, hosted model one, GateMem plus LongMemEval subset plus MERIT. P: E9.5 twin dogfood: every member runs a twin for two weeks. Friday: hosted points on the frontier.

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
| B7   | MERIT harness through the plane with cost accounting                                       | E2.2           | bench/merit/           | one task runs; cost recorded                        |
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
| X9   | H2 and H4 analysis: knee detection, cross-store violation equality test, utility gap; frontier figure                                                     | X6, X7, X8   | scripts/frontier_analysis.py   | results/frontier.png                               |
| X10  | H3 recovery: enforced plus lints at matched budget on LongMemEval and HaluMem                                                                             | L4, B8       | scripts/recovery.py            | results/recovery.csv                               |
| X11  | H5: tau2 and repository tasks with and without admitted skills; steps, success, violations                                                                | D3           | scripts/h5.py                  | results/h5.csv                                     |
| X12  | Failure analysis: five worked examples per hypothesis where the method or the plane is wrong                                                              | X9, X10, X11 | docs/failure-analysis.md       | reviewed by two members                            |
| X13  | Reproduction script: fresh clone regenerates every table and figure from committed caches; live re-runs are optional and skip cleanly without credentials | all X        | experiments/reproduce.sh       | runs clean on a fresh machine                      |

### D. Procedural module

| Card | Goal                                                                                                                                                   | Depends  | Files                  | Acceptance                                                        |
|------|--------------------------------------------------------------------------------------------------------------------------------------------------------|----------|------------------------|-------------------------------------------------------------------|
| D1   | Session recorder for tau2 tasks and a repository task set; sessions stored as episodic items                                                           | E2.3     | procedures/record.py   | fifty sessions recorded with task ids                             |
| D2   | Induction using a published method (Agent Workflow Memory or Trace2Skill, cited); candidates as procedural items with SKILL.md body and tool allowlist | D1       | procedures/induce.py   | candidates produced for a fixture session set                     |
| D3   | Replay validation gate: re-run originating tasks with the candidate installed; admit at or above threshold via promote                                 | D2, E2.5 | procedures/validate.py | a failing candidate stays candidate; a passing one becomes active |
| D4   | Drift detection: periodic re-validation; retire below threshold (kill list item 1)                                                                     | D3       | procedures/drift.py    | fixture with a changed task retires the skill                     |

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
| E8.8  | Review queue for candidates and promotions                                                   | E2.5, E8.5 | ui/                       | approve promotes; reject retires                       |
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

## Compute and data budget

- **Models.** Three hosted models from different providers, fixed in the pre-registration. The primary carries every sweep (X2, X3, X6, X10, X11, lint evaluation); the second and third run a fixed subset per benchmark (about 100 GateMem probes, 100 MPBench attacks, 200 LongMemEval questions, 50 MERIT tasks, at three conditions and two presets). Order of magnitude: low thousands of dollars across all three with caching; set a ceiling per provider and stop at it.
- **Optional seeded arm.** If the lab can serve an open-weights model, one seeded run of X2 and X6 gives bit-exact reproduction. It is an addition to the protocol, never a dependency; no card blocks on it.
- **Caching.** Every model call keyed on (benchmark item, condition, preset, store, seed). A re-run with the same config makes zero new calls. This is X1's acceptance test and the single largest cost control.
- **Data.** Benchmark data from pinned upstream commits, vendored. Seeded faults generated by L2 from benchmark memory states. Dogfood data stays on members' machines; only aggregate violation counts enter the repository.
- **Storage.** Event logs and caches committed as compressed fixtures for the local-model runs so X13 works offline; hosted caches committed too, so reviewers can regenerate tables without credentials.

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
| Model-based lint variance above bound | L3 pilot           | Deterministic lints as the floor; model-based secondary                    |
| API spend hits ceiling                | During X6 to X8    | Stop; report the completed subset; the primary model carries the frontier  |
| Member unavailable two weeks          | Any time           | Owner column reassigns; kill list in order                                 |
| Name collision                        | W1 check           | Fallbacks: Trace, Keep                                                     |

### Kill list, in order

1.  E9.7 twin offboarding automation (keep the scope split)
2.  B9 MemoryAgentBench forgetting split
3.  E8.9 simulator beyond the CLI
4.  E8.10 diff view and inspector polish
5.  D4 procedural drift detection (keep admission by replay). Last, because Distill is a core sell.

**Never cut:** E0, E1, A1, A3, A4, E2.1 to E2.3, E2.5, L1, L2, L4, B1 to B6, D1 to D3, R1, X1 to X6, X9, X10, X11, X13.

## Appendix: deferred items

Out of scope for the degree, listed so they are not forgotten when the company starts.

- **Legal and consent design for workplace twins.** Deferred by decision. The scope split and grants exist as mechanisms; the policy work (what an employer may grant itself, deletion proofs, regional rules) is the first post-degree workstream.
- **Third and fourth adapters.** Zep via Graphiti, LangGraph Store, Redis Agent Memory Server. Engineering against the conformance suite.
- **Enterprise features.** SSO, retention proofs, on-premises deployment, key custody for signed event logs.
- **Procedural memory beyond the gate.** Co-evolution of skills with the policy, as the literature now does; adopt rather than invent.
- **Harness-native plugins.** A Claude Code plugin and a Codex configuration that route memory reads and writes through the plane by default, reusing the Inquest adapter work.

Prepared 2 October 2026. Companion: the Engram proposal, which holds the gap analysis, hypotheses, evaluation protocol and sources.

