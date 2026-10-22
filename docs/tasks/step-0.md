# Step 0: foundational stage

Everything that has to exist before card E0.1 so that the first real card is worked under the conventions rather than before them. Thirteen tasks, in order; each is sized for one coding-harness session. Work them in pi with the project extension loaded, or in Claude Code with `CLAUDE.md` present. Every task ends with a log entry.

Prompt pattern for all of them:

```
You are doing step-0 task {ID} in the Engram repository. Read AGENTS.md, docs/conventions/testing.md and docs/conventions/documentation.md first.
Goal: {goal}
Files you may create or touch: {files}
Acceptance: run `{acceptance}`; it must pass. Do not weaken it.
Then write docs/log/{date}-{slug}.md as the documentation convention requires, type {type}.
Start by proposing a plan. No em dashes in any prose.
```

## S0.1 Bootstrap the monorepo

Goal: pnpm workspace, uv workspace, Makefile with every command in AGENTS.md as a target (stubs allowed), biome, tsconfig base, vitest, fast-check, ruff, mypy, pytest, hypothesis, GitHub Actions running `make lint` and `make test`.
Files: root configs, `packages/*/package.json` stubs for core, adapters, pi-extension, runner, bench, mcp, cli, server, ui; `research/pyproject.toml`.
Acceptance: `make test` green on an empty suite locally and in CI; `make lint` green.
Log type: change.

## S0.2 Commit the body of knowledge and the pi project setup

Goal: `AGENTS.md`, `CLAUDE.md` (a copy, with a CI check that it equals `AGENTS.md`; symlinks are unreliable on Windows), `README.md`, `docs/conventions/`, `docs/decisions/`, `docs/readings/README.md` (the list and the note template), `docs/glossary.md` (the they-say-we-say table), `docs/deps.md`, `docs/log/` with a template entry, `.pi/settings.json`, `.pi/APPEND_SYSTEM.md` (the card prompt pattern and the rules a session must keep), `.pi/prompts/card.md`, `.pi/prompts/log-entry.md`, `.pi/prompts/adr.md`, `.claude/settings.json` and `.claude/commands/` mirroring the prompts, `.github/PULL_REQUEST_TEMPLATE.md` with acceptance and log-entry fields.
Acceptance: `pi` in the repo loads the context file and the three prompts appear as slash commands; `make lint-docs` passes (frontmatter check, em-dash check, CLAUDE.md equals AGENTS.md).
Log type: milestone.

## S0.3 CI gates for the conventions

Goal: a check that every PR diff touches `docs/log/`; a check that the PR body contains an `Acceptance:` line with a command; the frontmatter validator for log entries (fixed field set, enum values, evidence paths exist); the em-dash check over `docs/` and `*.md`.
Files: `.github/workflows/conventions.yml`, `scripts/check-log.ts`, `scripts/check-pr.ts`, `scripts/check-prose.ts`.
Acceptance: `make lint-docs` fails on a fixture PR with no log entry and passes on one with a valid entry (both fixtures committed under `fixtures/ci/`).
Log type: change.

## S0.4 Log consolidation script

Goal: `research/scripts/consolidate_log.py` as specified in the documentation convention: validates entries, writes `research/thesis/drafts/{chapter}.md`, `timeline.md`, `limitations.md`, `results-index.md`, `decisions.md`.
Files: the script, `research/tests/test_consolidate.py`, `fixtures/log/` with ten entries and their expected drafts.
Acceptance: `make thesis` on the fixture log produces byte-identical drafts; `pytest research/tests/test_consolidate.py` green.
Log type: change.

## S0.5 Pin pi and prove the interception points

Goal: exact-pin `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai`; vendor `extensions/types.ts` for the events we use; write `packages/pi-extension` with a minimal extension that (1) registers `memory_write` and `memory_read` stub tools, (2) in `tool_call` blocks any `memory_write` whose input has `scope: "org"`, (3) in `context` tags injected memory messages, (4) appends a `custom` entry `customType: "engram.event"` for each decision, (5) in `user_bash` blocks a command list. Test it through `createAgentSession` with `SessionManager.inMemory()` and a scripted model that issues the tool calls.
Files: `packages/pi-extension/src/`, `packages/pi-extension/test/`, `packages/runner/src/model/scripted.ts`, `docs/deps.md`.
Acceptance: `pnpm --filter pi-extension test` shows the block, the tag, the custom entry and the bash block; the session JSONL fixture is committed under `fixtures/sessions/s0-interception.jsonl` with its `.expected.json`.
Log type: finding (record exactly which events behaved as documented and any that did not).

## S0.6 Verify benchmark availability and write the pins

Goal: for GateMem, MPBench, LongMemEval, MERIT, MemoryAgentBench and tau2-bench, find the code and data release (or establish that none exists), record repository, commit, licence, data format, judge type (deterministic, model-based, human) and how an external agent plugs in. Write `packages/bench/PINS.md`. Where no code is released, write to the authors and record the date; draft the fallback (reconstruct the probe format from the paper) as a task.
Files: `packages/bench/PINS.md`, `docs/log/` entries per benchmark.
Acceptance: `PINS.md` has a row per benchmark with every column filled or marked "none, contacted on {date}"; every repository URL in it resolves.
Log type: finding, one per benchmark.

## S0.7 Schema v0 and generated contracts

Goal: ADR 0002 as code: Zod 4 schemas for `MemoryItem`, `MemoryEvent`, `Policy`, `Grant`, `Explanation`, `LintFinding`; `z.toJSONSchema` export to `sdk/schema/*.json`; Python types generated from them into `research/engram_types/`; `make api` regenerates all of it and `make api-check` fails on a dirty tree.
Files: `packages/core/src/schema.ts`, `sdk/schema/`, `research/engram_types/`, Makefile.
Acceptance: `make api && git diff --exit-code` passes; a round-trip test parses each fixture item through Zod and validates it against its JSON Schema.
Log type: change.

## S0.8 Db interface, migrations, event append, replay skeleton

Goal: ADR 0003 as code: `Db` interface over `node:sqlite` with `exec`, `prepare`, `transaction`; a migration runner; `appendEvent`, `eventsByItem`, `eventsByActor`, `eventsByScope`; a `rebuild()` projection for items; replay test that rebuild equals incremental for a random event sequence.
Files: `packages/core/src/db/`, `packages/core/src/events.ts`, `packages/core/test/replay/`.
Acceptance: `pnpm --filter core test` green, including a property test over 500 random event sequences.
Log type: change.

## S0.9 Invariants file, red

Goal: `packages/core/test/property/invariants.test.ts` with fast-check generators for policies, scopes, grants, items and actors, asserting the four properties in the testing convention against a `Plane` interface whose implementation is a stub that admits everything. The file must fail.
Files: `packages/core/test/property/invariants.test.ts`, `packages/core/src/plane.ts` (interface and stub only), `packages/core/test/generators.ts`.
Acceptance: the invariants test fails with a readable counterexample and a printed seed; it is marked as the one allowed red test in CI until E2.1 lands (tracked by an issue referenced in the file).
Log type: change.

## S0.10 Model call layer: scripted, cached, metered, offline

Goal: ADR 0017 as code: `ModelCall` type; `scripted.ts` (table keyed on request hash, loud failure on miss); `cached.ts` wrapping any `ModelCall` with the cache key from the ADR, usage and cost capture, and `ENGRAM_OFFLINE=1` refusal; a pi-ai backed `ModelCall` built from a session's model runtime, in `packages/runner` only.
Files: `packages/runner/src/model/`, `fixtures/cassettes/README.md`.
Acceptance: tests show a second identical call makes zero underlying calls, that offline mode throws on a miss, and that usage is recorded; `packages/core` has no import from pi-ai (a lint rule enforces it).
Log type: change.

## S0.11 Fake adapter and conformance suite skeleton

Goal: ADR 0013 as code: the `Adapter` interface with capability flags; a complete in-memory fake; the conformance suite as a function `conformance(adapterFactory)` covering read, write, delete, list, optional search and history, and `store_ref` opacity.
Files: `packages/adapters/src/contract.ts`, `packages/adapters/src/fake/`, `packages/adapters/test/conformance/`.
Acceptance: the fake passes the whole suite; the suite is exported so A1 to A3 can call it.
Log type: change.

## S0.12 Pre-registration v0 and its test

Goal: `docs/research/preregistration.md` v0 with the five hypotheses, the seven conditions, the six benchmarks, the metric, test, seeds, models (placeholders where provider choice is pending), stopping rule and analysis per hypothesis; `research/tests/test_prereg.py` checking completeness; git tag `prereg-v0`.
Files: `docs/research/preregistration.md`, `research/tests/test_prereg.py`.
Acceptance: `pytest research/tests/test_prereg.py` green; tag exists.
Log type: milestone.

## S0.13 Decide the proposed ADRs

Goal: go through `docs/decisions/README.md` 0002 to 0023 with the team; for each, accept as written, amend, or reject with a reason; split accepted ones into their own `NNNN-<slug>.md` files with status accepted; rewrite roadmap cards E0.1, E0.3, E8.1, E8.3 and add PX1 to PX3, RN1, RN2 under `docs/tasks/`.
Files: `docs/decisions/`, `docs/tasks/`, `docs/log/`.
Acceptance: every ADR in the index has a status other than proposed, and each has a `decision` log entry; `docs/tasks/` has a card for every roadmap item including the new ones.
Log type: decision, one per ADR.

## Exit criterion for step 0

`make test`, `make lint`, `make lint-docs`, `make api-check` and `make thesis` all run in CI; the interception fixture exists; PINS.md is complete; invariants 1 and 2 are the only red properties, held as expected failures; every ADR is decided. Then E0.1 is already done by S0.1 and work starts at E0.2.

## Outcome, 2026-10-22

| task | status | where |
|---|---|---|
| S0.1 | done | Makefile, CI green; TypeScript 7 on the lead's instruction |
| S0.2 | done | `make lint-docs`; pi loads AGENTS.md once and lists the three prompts |
| S0.3 | done | `scripts/check-pr.ts`, `fixtures/ci/`, `conventions.yml` |
| S0.4 | done | `research/scripts/consolidate_log.py`, `make thesis` byte-identical on `fixtures/log/` |
| S0.5 | done | `packages/pi-extension`, `fixtures/sessions/s0-interception.jsonl` |
| S0.6 | done except one item | `packages/bench/PINS.md`; MPBench has no release and the request to its authors is drafted, not sent |
| S0.7 | done | `packages/core/src/schema.ts`, `make api-check` |
| S0.8 | done | `packages/core/src/events.ts`, replay property over 500 sequences |
| S0.9 | done, red by design | `packages/core/test/property/invariants.test.ts`: invariants 1 and 2 run in `make test` as expected failures until E2.2 and E2.3, issue #1 |
| S0.10 | done | `packages/runner/src/model/`, the pi-import lint rule |
| S0.11 | done | `packages/adapters`, conformance suite on the fake |
| S0.12 | done | `docs/research/preregistration.md`, tag `prereg-v0`; hypotheses reconstructed, thresholds proposed, models pending |
| S0.13 | done except one item | ADRs 0002 to 0023 decided except 0020 (licence, the owner's call); cards for every roadmap item and PX1 to PX3, RN1 to RN2 |

Exit criterion: `make test`, `make lint`, `make lint-docs`, `make api-check` and `make thesis` run in CI; the interception fixture exists; PINS.md is complete except MPBench's contact date; invariants 1 and 2 are the only red properties, held as expected failures; every ADR is decided except 0020. Since then (2026-10-22): ADR 0020 accepted (Apache-2.0); the pre-registration, MPBench and the ADR review session are in `docs/tasks/backlog.md`.
