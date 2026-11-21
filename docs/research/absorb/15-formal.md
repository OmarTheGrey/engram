# 15-formal: formal methods and advanced testing

## Executive summary

Engram's strongest claims (an erased item never comes back, no write lands in a scope being erased, a stale decision never commits) are protocol properties of `packages/core/src/plane/commit.ts`, `offboard.ts` and `adopt.ts` under concurrent handles. Today they are defended by seven fast-check invariants (including a two-handle walk under `fc.scheduler()` with crashed writers, card E2.6), plus hand-run mutation checks recorded in docs/log. The best upgrades, all Apache-2.0/MIT and without Docker, are: (1) a Quint spec of the commit and erasure protocol, model checked with Apalache and replayed as traces against the real Plane; (2) a fast-check state machine of the Plane with the invariants checked after every step, plus a seeded two-handle scheduler that shrinks races; (3) StrykerJS on the policy and commit files with a ratcheted score threshold. Lean/Coq proofs of the TypeScript are out of reach; Cedar's "model plus differential testing" pattern is the portable idea. Fuzzing (Jazzer.js) is low value here. Stars and dates below come from `gh api` on 2026-11-21.

## Landscape

| name | URL | licence | stars / last activity | language | gives us | absorb mode |
|---|---|---|---|---|---|---|
| Quint | github.com/quint-co/quint | Apache-2.0 | 2145 / 2026-11-20 (v0.33.1) | TypeScript | spec language, simulator, ITF traces (npm `@informalsystems/quint` 0.33.1, published 2026-10-28) | depend (dev tool) |
| Apalache | github.com/informalsystems/apalache | Apache-2.0 | 629 / 2026-11-18 (v0.63.0) | Scala (JVM) | symbolic model checker behind `quint verify` | depend (dev tool) |
| TLA+ / TLC | github.com/tlaplus/tlaplus | MIT | 3267 / 2026-11-19 | Java | explicit-state checker; thesis-friendly, matches 2606.24322 | ideas / optional |
| quint-connect (Rust, official) | github.com/quint-co/quint-connect | Apache-2.0 | 110 / 2026-05-25 | Rust | trace replay design to copy | ideas only |
| quint-connect-ts | github.com/dearlordylord/quint-connect-ts | Apache-2.0 | 15 / 2026-11-17 | TypeScript | third-party TS replay driver (npm `@firfi/quint-connect` 2.1.1, published 2026-11-17, under the two-week rule; pulls in `effect`, which Engram does not use) | port (vendor the ITF reader), do not depend |
| P | github.com/p-org/P | MIT | 3741 / 2026-11-18 | C# | state-machine spec and test | ideas only |
| Alloy 6 | github.com/AlloyTools/org.alloytools.alloy | NOASSERTION in gh api, licence file reads "Other" (unverified, so ideas only) | 890 / 2026-06-11 | Java | relational models | ideas only |
| fast-check | github.com/dubzzz/fast-check | MIT | 5296 / 2026-11-21 (v4.10.3; we pin 4.10.2) | TypeScript | `commands`, `asyncModelRun`, `scheduler` | already a dependency |
| StrykerJS | github.com/stryker-mutator/stryker-js | Apache-2.0 | 3404 / 2026-11-21 (v10.1.1) | TypeScript | mutation testing, vitest runner | depend (dev) |
| mutmut | github.com/boxed/mutmut | BSD-3-Clause | 1550 / 2026-11-19 | Python | mutation testing for `research/` | depend (dev, low priority) |
| Jazzer.js | github.com/CodeIntelligenceTesting/jazzer.js | Apache-2.0 | 368 / 2026-11-09 | TypeScript | coverage-guided fuzzing (v4.0.0 on npm, `@jazzer.js/core` CLI and a Jest runner) | ideas only |
| Cedar (Lean model, DRT) | github.com/cedar-policy/cedar-spec | Apache-2.0 | 228 / 2026-11-20 | Lean | verification-guided development pattern | ideas only |
| Lean 4 | github.com/leanprover/lean4 | Apache-2.0 | 10099 / 2026-11-21 | Lean | proofs of a pure decision function | ideas only (thesis appendix) |
| TigerBeetle (VOPR) | github.com/tigerbeetle/tigerbeetle | Apache-2.0 | 17419 / 2026-11-11 | Zig | deterministic simulation design | ideas only |

Coq was not researched beyond noting Lean has the closer precedent (Cedar). Antithesis is a commercial platform; its TypeScript SDK (MIT, 9 stars) is not a path.

## PR plans

### AB-FRM-1: Quint spec of the commit and erasure protocol, model checked
- goal: `specs/commit.qnt` modelling N handles over one log: decide at head, conditional append, offboard begin / sweep / report, adopt, write-after-erase. Safety invariants: (S1) no allow event for an item in a person scope appended after its `offboard/begin` mark (the `erasureBegunSince` rule in `commit.ts`); (S2) an erased id is never re-admitted; (S3) every store record has a log event that allowed it, or is swept before the report; (S4) two handles never both append an allow for the same item version. Plus a deliberately broken variant (drop the head check) that the checker must refute.
- absorbs: Quint, Apalache.
- files: `specs/commit.qnt`, `specs/README.md`, `Makefile` (`verify-spec`), `docs/deps.md`, `docs/architecture.md` (link), AGENTS.md command list, ADR for choosing Quint over TLA+.
- effort: M
- depends on: none (E2.6 is merged).
- value: product: finds protocol bugs before users. Thesis: a model-checked safety property is the headline formal result of Part I; bounded claim stated honestly.
- risks: needs a JVM for Apalache (kept out of `make test`, the CI is nonfunctional anyway so it is a local gate); bounded, not a proof; Quint language is young (v0.x). Licences clean.
- acceptance: `make verify-spec` exits 0 on `commit.qnt` and exits non-zero with a counterexample on `commit-broken.qnt`.

### AB-FRM-2: Replay spec traces against the real Plane
- goal: generate ITF traces from the spec (`quint run --mbt`), drive `createPlane` with two handles on SQLite from each trace, and compare the log and projection with the spec state after every step.
- absorbs: quint-connect pattern (vendor a ~150-line ITF reader and driver, or depend on `@firfi/quint-connect` after vetting).
- files: `packages/core/test/spec/trace-replay.test.ts`, `packages/core/test/spec/driver.ts`, `docs/deps.md` if the dependency route.
- effort: M
- depends on: AB-FRM-1.
- value: ties the model to the code, so the spec cannot silently drift. Thesis: "implementation conforms to the checked model on N traces".
- risks: third-party port is small (15 stars) so vendoring is safer; the driver must not import policy logic (rule 1 is about core, a test driver is fine).
- acceptance: `make test-one T=packages/core/test/spec/trace-replay.test.ts` passes on 200 traces with a fixed seed.

### AB-FRM-3: fast-check model-based test of the Plane as a state machine
- goal: `fc.commands` over write, read, changeGrants, promote, retain, offboard, adopt, reopen handle, advance clock; an independent model (reuse `packages/core/src/oracle.ts`, re-exported by `test/property/oracle.ts`) and the seven invariants asserted after every command; shrinking yields a minimal command list printed with the seed.
- absorbs: fast-check model-based API (already installed, 4.10.2).
- files: `packages/core/test/property/plane-machine.test.ts`, `packages/core/test/property/plane-commands.ts`, `Makefile` (`test-invariants` runs only `invariants.test.ts`, so add the new file and keep `ENGRAM_INVARIANTS=1`), `docs/conventions/testing.md`.
- effort: M
- depends on: none. Note `invariants.test.ts` is lead-owned; add a new file, do not edit it.
- value: reaches write, grant, offboard, adopt sequences the case-at-once tests do not compose. Thesis: stateful testing evidence for the seven invariants.
- overlap: `invariants.test.ts` already composes write, derive, grant, promote and offboard walks and its two-handle walk (`twoHandleWalk`); the new value is only per-step checking and `fc.commands` shrinking, so keep the scope to that.
- risks: oracle shared with implementation makes it vacuous; add guards like the existing "cannot pass vacuously" ones. Runtime: cap numRuns.
- acceptance: `make test-invariants` passes, and a seeded mutation (remove the erased-id check in `write.ts`) fails it with a printed minimal sequence.

### AB-FRM-4 (DROPPED, see Verification): Deterministic simulation of concurrent writers with fault injection
- goal: a simulation harness with N handles over one SQLite log, a seeded `fc.scheduler`, a fake store whose write/delete can throw or crash between store write and event append, and a clock; each run replays from a single seed; checks invariants plus S1 to S4 of AB-FRM-1 on the final log. A `make simulate-concurrency SEED=<n> HANDLES=<k>` runner for soak runs.
- absorbs: TigerBeetle VOPR and FoundationDB ideas, fast-check scheduler.
- files: `packages/core/test/sim/` (new), `packages/core/test/fakes/faulty-store.ts`, `Makefile`, `docs/conventions/testing.md`.
- effort: L
- depends on: AB-FRM-3 for commands (can share), E2.6.
- value: the thesis can report "X million seeded interleavings, zero violations", and a regression reproduces from one seed. Product: confidence on offboarding.
- risks: only reaches await-point interleavings in one Node process; real Postgres locking stays covered by the existing two-handle tests, not by the simulator.
- acceptance: `make simulate-concurrency SEED=1 HANDLES=3` exits 0 and, with the head check removed from `commit.ts`, exits 1 printing the failing seed.

### AB-FRM-5: StrykerJS mutation testing with a score threshold
- goal: `stryker.config.json` scoped to `packages/core/src/policy/**`, `plane/commit.ts`, `plane/write.ts`, `plane/read.ts`, `plane/offboard.ts`; vitest runner, SQLite only (`ENGRAM_PG=skip`), incremental; `thresholds.break` set to the measured baseline and ratcheted; surviving mutants triaged in a log entry and either killed by new oracle cases or listed as equivalent.
- absorbs: StrykerJS 10.1.1 and `@stryker-mutator/vitest-runner`.
- files: `stryker.config.json`, `package.json` (dev deps), `Makefile` (`mutate`), `docs/deps.md` (one row each), `docs/conventions/testing.md`, AGENTS.md commands.
- effort: M
- depends on: none.
- value: converts the manual "mutation survived" practice in docs/log into a gate. Thesis: mutation score is a credible test-quality metric to cite for "every generated component carries tests".
- risks: vitest 5.0.5 support is declared via peer range >=2.0.0 but unrun (verify first); runtime hours, so scheduled or per-file, not in `make test`; equivalent mutants. Apache-2.0, fine.
- acceptance: `make mutate` exits 0 at the committed threshold and non-zero when a policy test is deleted.

### AB-FRM-6 (DROPPED, see Verification): Differential test of the pure decision functions against a reference model
- goal: a second, deliberately simple implementation of the write gate and read filter in test code (Cedar's DRT pattern), run on large generated inputs, equal outputs required; the diff prints the minimal input. Optionally a Lean 4 transcription of `grants.ts` as a thesis appendix.
- absorbs: Cedar verification-guided development (note 2407.01688).
- files: `packages/core/test/property/differential.test.ts`, `packages/core/test/property/reference-gate.ts`.
- effort: S for the differential test, L for Lean.
- depends on: none.
- value: strong thesis narrative ("verification-guided"), cheap. Lean part optional.
- risks: two implementations share a misreading of the spec; mitigate with ADR citations per branch. Lean has no TypeScript link.
- acceptance: `make test-one T=packages/core/test/property/differential.test.ts` passes on 10,000 cases and fails against a mutated gate.

## Recommended order

1. **AB-FRM-3** (model-based Plane test): no new dependency, fast, finds real sequence bugs, and feeds AB-FRM-2 and AB-FRM-4.
2. **AB-FRM-1 then AB-FRM-2** (Quint spec plus trace replay): the visible "model-checked safety property" result for the thesis and the lead.
3. **AB-FRM-5** (Stryker gate): objective, ratcheted quality number; start early because the baseline needs measuring and triage takes time.

AB-FRM-4 and AB-FRM-6 are dropped after verification (see below).

## Not verified

- Stryker vitest-runner against vitest 5.0.5 (peer range only).
- Maintenance quality of quint-connect-ts and its `@firfi` npm scope.
- Alloy's licence (gh reports NOASSERTION).
- Cedar numbers (4 and 21 bugs, 5 vs 7 microseconds) come from a search summary of the paper, not a full read.
- TigerBeetle VOPR and FoundationDB practices are background knowledge, not re-read.
- Whether Apalache runs acceptably on this Windows box (JVM) was not tested.

## Verification (2026-11-21)

Checked with `gh api`, `npm view`, the arXiv abs pages and greps of the repo.

**Verified correct:** licence, stars, last push, language for all 14 repos (Quint 2145, Apalache 629, TLA+ 3267, quint-connect 110, quint-connect-ts 15, P 3741, fast-check 5296, Stryker 3404, mutmut 1550, Jazzer.js 368, cedar-spec 228, Lean 10099, TigerBeetle 17419); Quint, Apalache (v0.63.0) and Stryker (v10.1.1, vitest-runner peer `vitest >=2.0.0`) versions; fast-check latest 4.10.3 against the pin 4.10.2. arXiv 2407.01688 is "How We Built Cedar: A Verification-Guided Approach" and 2606.24322 is the Origin-Bound Authority paper, both as cited.

**Corrected:**
- Jazzer.js is not "Jest only": v4.0.0 ships a standalone `@jazzer.js/core` CLI beside the Jest runner. Still ideas only.
- Alloy: the licence file reads "Other" as well as NOASSERTION, so it stays ideas only.
- `@firfi/quint-connect` pulls in `effect` and was published 2026-11-17 (under the two-week rule), so AB-FRM-2 must vendor the ITF reader, not depend. The Quint npm package is `@informalsystems/quint`.
- S1 in AB-FRM-1 was garbled and is restated to match `erasureBegunSince` in `commit.ts`.
- The oracle lives in `packages/core/src/oracle.ts` (the `test/property/oracle.ts` file is a 6-line re-export); the Makefile `test-invariants` target runs only `invariants.test.ts`.
- Litreview notes: the Cedar note pointed at the wrong PR ids and the fast-check note ignored the existing scheduler walk; both fixed. No em dashes found in the report's notes.

**Refuted:** the premise that stateful and concurrent testing is new. `invariants.test.ts` already has `twoHandleWalk` under `fc.scheduler()` with crashed writers between store write and commit (lines near 94, 608 to 630, 2222 to 2330). `packages/core/src/oracle.ts` (712 lines) already is the independent reference model Cedar's DRT pattern calls for.

**Plan verdicts:** AB-FRM-1 keep; AB-FRM-2 keep-with-fix (vendor); AB-FRM-3 keep-with-fix (narrow scope); AB-FRM-4 drop (duplicates E2.6's walk); AB-FRM-5 keep-with-fix (verify the Stryker run on vitest 5.0.5 first, per-file); AB-FRM-6 drop (duplicates the oracle). Not verified: Apalache on this Windows box, Cedar paper's bug counts.
