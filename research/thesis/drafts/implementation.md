# Implementation

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Plane

**2026-10-17, milestone.** The body of knowledge for the repository was written before any code: operating manual, ADR 0001 (pi as base), documentation and testing conventions, proposed ADRs 0002 to 0023, the step-0 task list, the readings list and the glossary. So the first card is worked under the conventions rather than before them, and so the thesis can be assembled from the log instead of from memory. Files listed under evidence. No measurements yet. Step 0 starts at S0.1. ADRs 0002 to 0023 are decided in S0.13.[^1][^2][^3][^4]

**2026-10-17, decision.** The lead removed the PR size limit: AGENTS.md rule 10 no longer caps a PR at 400 changed lines or asks for a card to be split first, and the card prompt pattern no longer says "Keep the diff under 400 lines". The limit was forcing cards such as S0.3 (518 changed lines, mostly tests) to be split into halves that are not useful on their own. Rule 10 now reads "One task card per PR. Title is the card id and its goal." The same sentence is gone from `docs/tasks/step-0.md` and `.pi/APPEND_SYSTEM.md`. One card per PR still holds; reviewers judge size case by case.[^5][^6][^7]

**2026-10-17, S0.1, failure.** Running `biome migrate --write` on Biome 2.5.15 to replace the deprecated `rules.recommended: true` produced `rules.preset: "none"`, which turns every lint rule off. The deprecation notice asked for the migration; the result was only caught because the config was read back after migrating. With `preset: "none"`, `make lint` passed while enforcing nothing. After setting `preset: "recommended"`, a probe file with `any`, `==`, an inner `var` and an unused variable produced four diagnostics (`noExplicitAny`, `noDoubleEquals`, `noInnerDeclarations`, `noUnusedVariables`). Any future Biome migration is followed by reading `biome.json` back and running a probe before merging.[^8][^9]

**2026-10-17, S0.1, change.** Step-0 task S0.1 bootstrapped the monorepo: pnpm workspace with nine package stubs (core, adapters, pi-extension, runner, bench, mcp, cli, server, ui), a uv workspace with `research` as its member, Biome, TypeScript, Vitest, fast-check, ruff, mypy, pytest, Hypothesis, a Makefile and a GitHub Actions workflow running `make lint` and `make test`. Every later card runs its acceptance command through the Makefile, so the commands must exist before the first real card. Before: `make test` failed with `Command "vitest" not found`. After: `make test` passes on an empty suite (Vitest with `passWithNoTests`, pytest exit code 5 accepted) and `make lint` passes. TypeScript is 7.0.2, not the 5.x in ADR 0019, on the lead's instruction; ADR 0019 is amended. Unimplemented targets exit 2 naming their card. Windows members need GNU make (`winget install ezwinports.make`).[^10][^11][^12][^13]

**2026-10-17, S0.1, failure.** The first CI run of S0.1 failed before any step ran because `astral-sh/setup-uv@v10` does not resolve. The workflow used floating major tags for every action. `actions/checkout`, `actions/setup-node` and `pnpm/action-setup` publish them; `astral-sh/setup-uv` stopped at `v7`, and its current release is only tagged `v10.3.0`. Run 39048041089 failed in "Set up job" with "unable to find version `v10`". The workflow now pins `astral-sh/setup-uv@v10.3.0`. Before adding an action, check that the tag exists (`gh api repos/<owner>/<repo>/git/matching-refs/tags/v`).[^14][^15]

**2026-10-17, S0.2, milestone.** Step-0 task S0.2 completed the body of knowledge and the harness setup: `make lint-docs` (em dashes in prose, CLAUDE.md equals AGENTS.md, log entry field set), a log template at `docs/log/_template.md`, the card prompt pattern and session rules in `.pi/APPEND_SYSTEM.md`, and `.claude/` settings and commands mirroring the three pi prompts. CLAUDE.md was described as a symlink, which is unreliable on Windows, so it is now a copy that CI compares byte for byte. pi 1.3.0 in RPC mode (`get_commands`, run with `-a`) lists `adr`, `card` and `log-entry` as project prompts; its resource loader finds one context file, AGENTS.md, so the copy is not loaded twice. `make lint-docs` passes, and fails on a seeded em dash, a drifted CLAUDE.md and an entry missing fields. S0.3 hardens the log validator and adds the PR checks.[^16][^17][^18][^19][^20]

**2026-10-17, S0.3, change.** Step-0 task S0.3 added the convention gates: `check-pr.ts` (the PR body has an `Acceptance:` line with a real command, and the diff adds a valid docs/log entry), a full log validator (field set, enums, real dates, H1 to H5, evidence paths exist, supersedes points at an entry, body sections in order, at most 150 words), fixture PRs under `fixtures/ci/`, and `conventions.yml` running the gate on every pull request. AGENTS.md rule 14 and the documentation convention say CI rejects a PR without a log entry or an acceptance command. `make lint-docs PR=fixtures/ci/pr-no-log` fails with "PR diff must add or change an entry under docs/log/"; `PR=fixtures/ci/pr-valid` passes; both are asserted in `scripts/test/fixtures-ci.test.ts`. All seven existing entries pass. Edits to existing entries are not yet detected; immutability is enforced in review only.[^21][^22][^23][^24][^25][^26]

**2026-10-17, S0.3, failure.** On Windows, the check scripts crashed with a libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`, `src\win\async.c`) when they called `process.exit(1)` straight after writing problems to stderr. `process.exit` tears the process down while the stderr pipe write is still pending; the scripts ran under make, whose stderr is a pipe. The gate still failed, but with exit code 127 and a crash message instead of exit code 1. Setting `process.exitCode` and returning lets the write finish; the same run now exits 1 with only the problem line. Scripts in this repository set `process.exitCode` and never call `process.exit` after writing output.[^27][^28]

**2026-10-17, S0.5, failure.** The S0.5 session fixture recorded on Windows failed on Linux CI. Three values were not stable: the faux provider's default API id embeds a timestamp and a random suffix; the system prompt carries the temporary working directory with forward slashes; and the faux provider estimates token usage from prompt length, which depends on that path. The first two were caught locally across repeated runs; usage was caught by CI, where input token counts differed by seven per call. The scripted model now takes a fixed API id, and the normalizer replaces both path spellings and the usage object. Session fixtures are accepted only after a green run on both Windows and Linux.[^29][^30]

**2026-10-17, S0.5, finding.** Step-0 task S0.5 pinned pi 1.3.0 and proved the interception points in a pi SDK session with a scripted model: tool_call blocks an org-scoped memory_write, context tags memory, every decision is an `engram.event` custom entry, and store commands are blocked in user_bash and in the model's bash tool. ADR 0001 rests on these events behaving as documented. tool_call, context and appendEntry behaved as documented; 15 tests pass. Three differences: `createAgentSession` has no `extensionFactories` option (it moved to `DefaultResourceLoader`); `session.executeBash` never emits user_bash, only the interactive and RPC hosts do; user_bash has no block result, so blocking returns a replacement result. The runner must emit user_bash itself. The context tag is request-local; the session keeps untagged results.[^31][^32][^33][^34]

**2026-10-22, change.** A file-backed event log now runs in WAL mode with a five-second busy timeout, and the outermost transaction begins IMMEDIATE. The final step-0 review found that two processes appending to one log would get "database is locked" at once, because the sequence read ran inside a deferred savepoint with no timeout. Tests show the pragmas are set on a file database, and that two connections appending in turn to one file keep a dense sequence 0 to 3. The 500-sequence replay property still passes. Several runner processes can share one log file; nested transactions remain savepoints.[^35][^36]

**2026-10-22, change, H4.** The Adapter contract now says `history` returns every distinct version under a ref, and the conformance suite checks that rewriting identical content adds no version. The final step-0 review found the fake skipped identical rewrites while the contract said every version written. A store that treats an identical rewrite as a no-op, as Mem0 does with NOOP, could not meet the stricter wording. The fake passes; a fake that records every write fails the new case. Real adapters are held to distinct versions only.[^37][^38]

**2026-10-22, S0.10, failure.** The test proving the pi-import lint rule timed out in the full suite although it passed alone. It spawned Biome three times per package; under a parallel `make test` each spawn took about two seconds, past Vitest's 5-second default. Two earlier designs also failed: Biome 2.5 in stdin mode exits 1 for a clean file without `--write` and prints no diagnostics with it, and probe files under `.gitignore` are skipped unless `--vcs-use-ignore-file=false` is passed. One Biome run per package over three probe files, counting three diagnostics, with a 30-second timeout; two full runs passed 114 of 114. Tests that spawn tools set an explicit timeout.[^39][^40]

**2026-10-22, S0.10, change.** Step-0 task S0.10 added the model call layer: `ModelCall` and `requestHash` in core; a scripted `ModelCall` keyed on the request hash that fails loudly on a miss; `cached()` with the ADR 0017 key, usage capture and an `ENGRAM_OFFLINE=1` refusal; a pi-ai backed `ModelCall` in the runner; and a Biome rule rejecting pi imports in core and adapters. AGENTS.md rules 4, 6 and 7: the plane never calls a model, and every call is seeded and cached. 13 runner tests: a second identical call makes zero underlying calls, offline mode throws on a miss and answers a hit, usage is recorded for hits and misses, and file cassettes survive a new process. Three tests show the import rule fires in core and adapters, not in the runner. `ModelCall` is a type in core, so lints and the distiller receive it without importing the runner.[^41][^42][^43][^44][^45]

**2026-10-22, S0.11, change, H4.** Step-0 task S0.11 added the `Adapter` contract (read, write, delete, list, optional search and history, capability flags), a complete in-memory fake, and the conformance suite as an exported `conformance(name, factory)` that adapters A1 to A3 call from their own tests. ADR 0013 and H4: every store is held to one contract, first on a fake, then in CI service containers. 32 cases pass on the fake with and without its optional methods: round trip, idempotent write, store_ref opacity (serialisable, foreign refs refused), delete visibility, scope-exact list, search never crossing the scope filter, recall on a five-item corpus, and history in order. Mutations that ignore the scope filter or skip deletion fail it. Refs are keyed by item id in the fake; real adapters may key differently because the plane never builds a ref.[^46][^47][^48][^49]

**2026-10-22, S0.11, failure.** The S0.11 commit was made and pushed while `make lint` failed on a TypeScript error in the conformance suite. The command chain ran lint, tests and the commit in sequence without stopping on the lint exit code; the tests passed, so the commit went through. The base fixture was typed as the whole MemoryItem union, so spreading it with new string content did not type-check. Commit 7515b0d typed it as a knowledge item; `make lint` passed afterwards. Commits are chained on `make lint && make test`, so a failing gate stops the commit; CI would also have caught it.[^50][^51]

**2026-10-22, S0.7, change.** Step-0 task S0.7 added schema v0 in Zod 4 for MemoryItem, MemoryEvent, Policy, Grant, Explanation and LintFinding, following `docs/architecture.md`; `make api` exports JSON Schema to `sdk/schema/` and generates Python TypedDicts in `research/engram_types/`, and `make api-check` fails on a dirty tree. ADR 0002: one source for the contract, every other shape generated. 30 tests: each of 28 fixtures is accepted or rejected identically by Zod and by the generated JSON Schema. Two `make api` runs produce byte-identical output. A fixture caught that procedural content without a tool list passed as a generic payload, so MemoryItem is now a union on `class`. Scope is a `level:id` string and ttl is in seconds; S0.13 records both in ADR 0002.[^52][^53][^54][^55][^56]

**2026-10-22, S0.8, change.** Step-0 task S0.8 added the `Db` interface (exec, prepare, transaction with savepoints) over `node:sqlite`, a forward-only migration runner, the append-only event log (`appendEvent` with a dense seq, queries by item, actor and scope) and an item projection with `rebuild()`. ADR 0003: the event log is the source of truth and store state is a projection that must be rebuildable. 9 unit tests and a fast-check property over 500 random event sequences (seeded from the test name): the rebuilt projection equals the incremental one. Replaying events in reverse breaks it after 6 runs with a shrunk two-write counterexample and the seed printed, so the test can fail. Core never reads the clock; callers supply event ids and timestamps. Node prints an ExperimentalWarning for `node:sqlite`.[^57][^58][^59][^60]

**2026-10-22, change.** Schema v0 changed in three ways from the final step-0 review: structured content must be JSON (a shared `JsonValue` definition exported beside the contracts), `Provenance` gains the optional `model` that ADR 0004 lists, and every exported schema carries a title so the generated Python types are named after their contracts. A Date or NaN in content changed on storage; ADR 0004's accepted option named a field the schema lacked; two generated types were called `Model`. New tests failed first and pass: content values JSON cannot carry are rejected, a model-written fixture validates in Zod and JSON Schema, and each Python module defines its contract's name. `schema_version` stays 0: v0 was never released or persisted, so no migration exists to write. The next change after a release bumps it.[^61][^62][^63][^64][^65][^66]

**2026-10-22, change.** Fixes for the eight important findings of the final step-0 review: allowed changing events must carry their item under the same id; `Db.transaction` refuses an async body; the Adapter contract moved to core and the Plane is asynchronous; the conformance suite tests an empty scope filter, skips missing optional methods visibly and moves full recall to an opt-in lexical suite; the cassette cache treats only a missing file as a miss, writes atomically and deduplicates calls in flight; pi subpath imports are rejected; ADRs 0002 to 0023 are marked pending the lead's review. Each would have cascaded into the E2 and A cards or misattributed decisions in the thesis. Every fix has a test that failed first; `make test` passes. Seventeen minor findings are deferred and listed in the step-0 report.[^67][^68][^69][^70][^71][^72]

## Research

**2026-10-17, S0.4, change.** Step-0 task S0.4 added `research/scripts/consolidate_log.py`: it validates every docs/log entry (the same rules as `scripts/check-log.ts`, plus measurement hashes against `research/results/MANIFEST.md`) and writes the seven chapter drafts, `timeline.md`, `results-index.md` and `decisions.md`. The thesis is assembled from the log, so consolidation must be deterministic and refuse invalid entries. On the ten-entry fixture under `fixtures/log/repo`, `make thesis` output is byte-identical to `fixtures/log/expected`; 9 pytest cases pass, including a tampered results hash and a measurement without a config. `limitations.md` holds both the failure list and the limitations chapter, because the convention names that file twice. Superseded entries are left out of all drafts. `make fixtures MSG=...` regenerates the goldens.[^73][^74][^75][^76]

**2026-10-22, change, H2.** Three minor review findings in the model call layer: a cache hit now records zero tokens and zero cost with the cassette's usage under `cached`; `ENGRAM_OFFLINE` is read on every call; earlier assistant turns reach pi-ai as typed assistant messages instead of a cast. Summing the cost ledger counted every rerun as a paid call, which would inflate the governance tax (H2); an offline flag set after the wrapper was built was ignored; the cast hid missing fields. Three new tests failed first and pass; the runner has 18 passing tests. Cost tables sum `cost_usd` directly; the cached usage stays available for audit.[^77][^78][^79]

**2026-10-22, S0.12, failure.** The tag `prereg-v0` was first created and pushed on commit 7515b0d, the S0.11 typing fix, instead of the pre-registration commit. The commit was chained behind `make lint`, which failed on a line-length error in `research/tests/test_prereg.py`, so no commit was made; the tag command ran on its own line and tagged the previous commit. Minutes later the remote tag was deleted and `prereg-v0` recreated on e57ac82, the pre-registration commit, and pushed; `git rev-parse prereg-v0^{}` gives e57ac82. No one had fetched the wrong tag. A tag is created only in the same chain as the commit it marks, after the commit succeeds.[^80][^81]

[^1]: `AGENTS.md`
[^2]: `docs/decisions/0001-pi-as-base.md`
[^3]: `docs/conventions/documentation.md`
[^4]: `docs/conventions/testing.md`
[^5]: `AGENTS.md`
[^6]: `docs/tasks/step-0.md`
[^7]: `.pi/APPEND_SYSTEM.md`
[^8]: `biome.json`
[^9]: `pnpm exec biome migrate --write`
[^10]: `Makefile`
[^11]: `.github/workflows/ci.yml`
[^12]: `make test`
[^13]: `make lint`
[^14]: `.github/workflows/ci.yml`
[^15]: `gh run view 39048041089 --log-failed`
[^16]: `make lint-docs`
[^17]: `scripts/check-prose.ts`
[^18]: `scripts/check-log.ts`
[^19]: `.pi/APPEND_SYSTEM.md`
[^20]: `.claude/commands/card.md`
[^21]: `.github/workflows/conventions.yml`
[^22]: `scripts/check-pr.ts`
[^23]: `scripts/check-log.ts`
[^24]: `scripts/test/check-log.test.ts`
[^25]: `fixtures/ci/pr-valid/files.txt`
[^26]: `make lint-docs PR=fixtures/ci/pr-no-log`
[^27]: `scripts/check-pr.ts`
[^28]: `make lint-docs PR=fixtures/ci/pr-no-log`
[^29]: `packages/pi-extension/test/harness.ts`
[^30]: `pnpm --filter pi-extension test`
[^31]: `fixtures/sessions/s0-interception.jsonl`
[^32]: `fixtures/sessions/s0-interception.expected.json`
[^33]: `packages/pi-extension/test/interception.test.ts`
[^34]: `pnpm --filter pi-extension test`
[^35]: `packages/core/src/db/sqlite.ts`
[^36]: `packages/core/test/unit/db/migrate.test.ts`
[^37]: `packages/core/src/adapter.ts`
[^38]: `packages/adapters/test/conformance/suite.ts`
[^39]: `scripts/test/pi-import-rule.test.ts`
[^40]: `make test`
[^41]: `packages/core/src/model.ts`
[^42]: `packages/runner/src/model/cached.ts`
[^43]: `packages/runner/test/model/cached.test.ts`
[^44]: `scripts/test/pi-import-rule.test.ts`
[^45]: `pnpm --filter runner test`
[^46]: `packages/adapters/src/contract.ts`
[^47]: `packages/adapters/src/fake/index.ts`
[^48]: `packages/adapters/test/conformance/suite.ts`
[^49]: `pnpm --filter adapters test`
[^50]: `packages/adapters/test/conformance/suite.ts`
[^51]: `git show 7515b0d`
[^52]: `packages/core/src/schema.ts`
[^53]: `sdk/schema/MemoryItem.json`
[^54]: `research/engram_types/MemoryItem.py`
[^55]: `packages/core/test/unit/schema.test.ts`
[^56]: `make api-check`
[^57]: `packages/core/src/events.ts`
[^58]: `packages/core/src/db/sqlite.ts`
[^59]: `packages/core/test/replay/rebuild.test.ts`
[^60]: `pnpm --filter core test`
[^61]: `packages/core/src/schema.ts`
[^62]: `sdk/schema/JsonValue.json`
[^63]: `fixtures/schema/MemoryItem/valid/model-written.json`
[^64]: `packages/core/test/unit/schema-content.test.ts`
[^65]: `research/tests/test_engram_types.py`
[^66]: `make api-check`
[^67]: `packages/core/src/events.ts`
[^68]: `packages/core/src/adapter.ts`
[^69]: `packages/adapters/test/conformance/suite.ts`
[^70]: `packages/runner/src/model/cached.ts`
[^71]: `biome.json`
[^72]: `docs/tasks/step-0.md`
[^73]: `research/scripts/consolidate_log.py`
[^74]: `research/tests/test_consolidate.py`
[^75]: `fixtures/log/expected/limitations.md`
[^76]: `make thesis ROOT=fixtures/log/repo OUT=<tmp>`
[^77]: `packages/runner/src/model/cached.ts`
[^78]: `packages/runner/src/model/pi.ts`
[^79]: `packages/runner/test/model/cached.test.ts`
[^80]: `docs/research/preregistration.md`
[^81]: `git rev-parse prereg-v0^{}`
