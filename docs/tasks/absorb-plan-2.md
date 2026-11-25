# The second absorb plan: thirty more pull requests, 2026-11-25

The lead asked, on 2026-11-25, to "pick another 30 most important prs from the bigger absorb roadmap and plan for doing them". The first plan (`docs/tasks/absorb-plan.md`) is merged in full, as PRs #69 to #110. This file is the second selection: thirty pull requests from the same research and from what the first thirty left behind. It is binding on the cards it names, as the first plan is on its own.

## 1. Where the selection comes from

- **The long list.** The 136 plans of `docs/research/absorb/long-list.md` that the first plan did not select, with their area studies, the master plan (`00-master-plan.md`) and the GitHub sweep (`19-github-scout.md`).
- **The first wave's follow-ups.** The `finding` entries of the logs of 2026-11-21 and 2026-11-22 (156 of them; there are no later entries on main), section F of `docs/tasks/lead-decisions.md`, and the backlog rows the first thirty cards left (`docs/tasks/backlog.md`).
- **The literature.** `docs/readings/litreview/`, the lead's source of truth, for every claim about a paper.
- **The code.** Every candidate was checked against main at `72e7ca0e`. Plans already built by the first wave were dropped: the crash-window failpoints (E1.4), the supersession head resolver (L6), the skill format (D2), the hold as a candidate (E2.9, E2.10), the quarantine plan R-062 with them.
- **Sources rechecked today.** Every repository named below was read with `gh api` on 2026-11-25: licence, stars, last push, and the head commit the card starts from. Two premises of the research changed and are logged as findings: the Model Context Protocol servers are in a licence transition from MIT to Apache-2.0 (both allowed), and four repositories have moved or been renamed.

Out of scope, because they are already in flight: the terminal interface on branch `cliupgrade` (card E8.15), and today's cards ANS-2026-11-25 (ADRs 0034 and 0042 to 0048 accepted), RD1 (what a read discloses: item 36's grants and lineage ids), L8 (lint reads through the read filter) and E9.9 (an owner accepts their own imported candidates). ADR numbers 0049 to 0051 are held by E9.9, RD1 and L8, so a card here that writes an ADR takes the next free number after them.

## 2. The selection tests

Four tests, in this order.

1. **It cannot endanger H1 or Gate C.** The `prereg-v1` tag is on 30 November and H1's live runs are 1 to 8 December. Before the tag only work that moves no registered byte merges: documents, tests and test tooling. During H1's runs nothing merges that changes code a registered config runs (`packages/runner`, `packages/model`, `packages/bench` source, `packages/core` source on the paths a condition reaches, `research/configs`), so a shard resumed by mistake from main runs what it ran. Every behaviour change is off by default and off in every registered preset. A change to a registered condition is a pre-registration amendment, which the lead decides; such a card is marked, and is scheduled after the tag.
2. **It serves a hypothesis or a gate, or closes a gap in a guarantee the thesis states.** H1 to H5 and Gates C and D first, then the products: Govern, Twin and Distill.
3. **It absorbs something we would otherwise write worse,** or it closes a follow-up a first-wave card found in our own code.
4. **It can be shown:** a Friday demonstration, a thesis table, or a screen.

What failed these tests, and why, is section 7.

## 3. How we absorb

ADR 0037 and `docs/conventions/absorption.md` hold the rules, unchanged since the first plan:

- **Licences.** Copy or port only from MIT, ISC, BSD, Apache-2.0, Unlicense or CC0. MPL-2.0 only as an unmodified dependency. Anything else is read for ideas only. The card rereads the licence at the commit it takes from, which may be newer than the one named here.
- **Modes.** *Copy* (the source's text, notice kept), *port* (our code from the source's design or data), *depend* (a pinned package, a row in `docs/deps.md`), *idea* (nothing taken but the approach, cited).
- **A register.** Every copy and port gets a row in `docs/absorbed.md` and, where the licence asks, a notice in `NOTICE`, in the same pull request. Card E0.6 makes `make lint-docs` check the register, so it comes first.
- **Our rules hold.** Policy logic in `packages/core` only, no model call and no store I/O there, seeds and cache keys for any model call, tests with every absorbed line.
- **No schema version bump.** The policy shares `SCHEMA_VERSION` with items and events, and C3 and C4 put the parsed policy, its version included, into their prompts (`docs/log/2026-11-21-e2-8-version-bump-moves-cassette-keys.md`). A bump would move H1's cassette keys after H1 has run, and H3's pinned fault-set hashes before H3 runs. So this plan adds policy options only as ADR 0002's decision D2 allows (additive, optional, absent by default, in one schema pull request, E2.14), and keeps plane-owned metadata in side tables, as ADR 0038 did for the hash chain. No card here bumps `schema_version`.

## 4. The thirty, in order

Lane R is the research spine, lane P the product. "Week" is the roadmap's week: W8 began on 23 November, the tag is on 30 November (the first day of W9), Gate C is the end of W10 (13 December), Gate D the end of W16 (24 January). "Depends on" names only what is not yet merged; RD1 and E9.9 are today's cards in flight.

| # | Card | Title | Lane | Week | Effort | Depends on |
|---|---|---|---|---|---|---|
| 1 | E0.6 | `make lint-docs` checks the absorbed register | R | W8 | S | none |
| 2 | E0.7 | Determinism guards: no network in tests, no clock or randomness in core | R | W8 | S | none |
| 3 | E8.16 | Cross-surface parity and leak suite | R | W9 | M | RD1 |
| 4 | E1.8 | Quint traces replayed against the Plane | R | W9 | M | none |
| 5 | X16 | Gate mutation audit: a frozen mutant set for every invariant | R | W9 | M | none |
| 6 | E9.10 | `engram discover`: harness memory outside the plane, counted, and its doctor check | P | W9 | M | none |
| 7 | X17 | The results page: every MANIFEST row beside its hash and its command | R | W10 | M | none |
| 8 | E1.7 | Erasure: close the two gaps the Quint model found | R | W10 | M | E1.8 |
| 9 | E2.14 | Policy schema: the options this plan's cards need, all absent by default | R | W10 | S | none |
| 10 | E2.15 | Provenance holds across rewrites, closes and imports | R | W10 | M | none |
| 11 | X18 | The paired fault-injection check for H3 (proposal U6) | R | W11 | M | none |
| 12 | X19 | The erasure-residue check (proposal U7) | R | W11 | M | E1.7 |
| 13 | E2.16 | The content guards: three gaps closed and the oracle taught the stage | R | W11 | M | none |
| 14 | E1.9 | The chain on every writer and over attestations; race-free first migration | R | W11 | M | none |
| 15 | L9 | Quote-grounding for the model lints, opt-in | R | W12 | S | E2.14 |
| 16 | D5 | The procedure safety scan at admission | R | W12 | M | E2.14 |
| 17 | A6 | A fourth store: the MCP reference memory server's JSONL file | R | W12 | M | none |
| 18 | E2.17 | Why not this item: the first rule that excluded it | R | W12 | M | RD1 |
| 19 | D4 | Drift: re-validation and retirement of admitted procedures (rewritten) | R | W13 | M | E2.14 |
| 20 | E2.18 | Preset properties proved by Cedar's symbolic compiler | R | W13 | M | none |
| 21 | E9.11 | Crypto-shredded erasure: the ADR and the key side table | P | W11 | M | E1.7 |
| 22 | E9.12 | Do not record: consent at the write gate for the person scope | P | W12 | M | E2.14 |
| 23 | E8.17 | Codex under the gate: its PreToolUse hook and an idempotent installer | P | W12 | M | none |
| 24 | E9.13 | Crypto-shredded erasure in offboarding | P | W13 | L | E9.11, X19 |
| 25 | E2.19 | The approval queue: held writes routed to named approvers, with expiry | P | W13 | M | E2.14, E9.9 |
| 26 | E9.14 | The signed erasure receipt, with residue verification | P | W14 | M | E9.13 |
| 27 | E8.8 | Approvals on every surface and the inspector's queue (rewritten) | P | W14 | L | E2.19 |
| 28 | E2.20 | Policy as code: `engram policy test` and `engram policy diff` with a ceiling | P | W15 | M | none |
| 29 | E9.15 | The signed audit report | P | W15 | M | none |
| 30 | E9.16 | The subject access export and the Article 30 record | P | W16 | M | none |

Existing cards the plan rewrites: D4 (open since the roadmap; unblocked by D3) and E8.8 (open; it now carries the approval surfaces). All others are new. Follow-ups of the first wave that the thirty close are listed in section 9.

## 5. Each pull request: why, how, and what it may not move

Every entry names its goal, its source with licence and the head commit read on 2026-11-25, the mode, the files, the acceptance, what it serves, its risks and its guard. "Guard" says what the card must leave byte for byte unchanged; for every card that is at least every file in `research/results/MANIFEST.md`, every fixture's expected output and every cassette, proved by running the MANIFEST rows and fixtures the change can reach. The entries are grouped by stage; the number is the card's place in the table.

### Before the tag (W8): test tooling only

**1. E0.6. `make lint-docs` checks the absorbed register.**
- *Goal.* `make lint-docs` fails when a row of `docs/absorbed.md` names a file that does not exist, a licence outside ADR 0037's list, or a copy with no `NOTICE` entry (ADR 0037, decision 8). The backlog said the first card adding a row would build it; none did.
- *Source.* None; our own check, in `scripts/`.
- *Files.* `scripts/check-absorbed.ts` (new), `scripts/test/check-absorbed.test.ts` (new), `Makefile` (`lint-docs`), `fixtures/ci/` (a red register).
- *Acceptance.* `make test-one T=scripts/test/check-absorbed.test.ts` and `make lint-docs` green on main's register.
- *Serves.* Rule 16, for every card below. *Risk.* Main's register may already fail it; the card then fixes the rows, each fix a `finding`. *Guard.* Touches no package.

**2. E0.7. Determinism guards: no network in tests, no clock or randomness in core.**
- *Goal.* Two test-side rules. A vitest setup that makes any socket, DNS or `fetch` call from a test fail at once when `ENGRAM_OFFLINE=1`, so a test that reaches the network fails rather than hangs (cards L7 and X14 each met tests that broke only under the variable). And a source rule, like `scripts/test/pi-import-rule.test.ts`, that refuses `Date.now`, an argument-free `new Date()`, `performance.now` and `Math.random` in `packages/core/src` outside the Postgres transport, which evidences crosswalk claim C44 as card R4 restated it.
- *Source.* Compartment `src/compartment/offline_guard.py` (Apache-2.0, `MaxFreedomPollard/Compartment` at `98d4917181c0`, idea); Scuttie's hidden-call audit (Apache-2.0, idea).
- *Files.* `vitest.shared.ts`, `scripts/test/core-determinism-rule.test.ts` (new), `docs/conventions/testing.md`.
- *Acceptance.* `make test-one T=scripts/test/core-determinism-rule.test.ts`, and a test that opens a socket under `ENGRAM_OFFLINE=1` fails with the guard's message.
- *Serves.* Rules 4, 6 and 7, so H1's replay claim; Part I. *Risk.* Tests that fetch pinned data must declare it; they are listed, not silenced. *Guard.* No source file changes. Crosswalk claim C44 is pointed at the new test after the tag, since that regenerates a committed result.

### During H1's runs (W9): tests, a model check, a read-only command

**3. E8.16. Cross-surface parity and leak suite.**
- *Goal.* One operation through the CLI, the HTTP API, MCP and the pi extension gives the same decision, reason, `policy_id` and event; canary strings written through every write path never reach a non-member, an expired grantee or a former member on any surface; a denied id and a missing id answer alike; a new route without a probe or a listed exemption fails the suite.
- *Source.* ClickHouse/loom `tests/integration/test_cross_principal_leakage.py` (Apache-2.0, `61b22646a1af`, port); plur-ai/plur's parity tests (Apache-2.0, `7c6aa73ba14e`, idea).
- *Files.* `packages/server/test/leakage.test.ts`, `packages/mcp/test/leakage.test.ts`, `packages/cli/test/parity.test.ts`, `packages/pi-extension/test/parity.test.ts` (all new), `docs/absorbed.md`, `NOTICE`.
- *Acceptance.* `make test-one` on each new file; `make test-e2e`.
- *Serves.* The thesis's "every read is filtered" as a zero-leak figure over every surface; Govern. Card X14 named a surface suite as its missing extension. *Risk.* A leak RD1 leaves is pinned as a characterisation test and logged, never fixed here. *Guard.* Tests only.

**4. E1.8. Quint traces replayed against the Plane.**
- *Goal.* Card E1.5's model is checked against itself; nothing checks that the code follows it. Generate ITF traces from `specs/commit.qnt`'s `good` module, replay each step on real Plane handles over one log, and compare the state after each step with the trace's.
- *Source.* Quint and its ITF trace format (Apache-2.0, `quint-co/quint` at `95141d4691cc`; the repository moved from `informalsystems/quint`; depend, already a development tool). A small ITF reader is written here, since `@firfi/quint-connect` stays unusable (long list).
- *Files.* `packages/core/test/model/itf.ts`, `packages/core/test/model/trace-replay.test.ts` (new), `specs/traces/`, `Makefile` (`verify-spec` gains the replay).
- *Acceptance.* `make verify-spec` and `make test-one T=packages/core/test/model/trace-replay.test.ts` over at least 200 traces, the two known gaps reproduced as the model states them.
- *Serves.* Part I: the commit and erasure protocol, the thesis's hardest guarantee. *Risk.* A mismatch that is not a known gap is a finding and a pinned test, not a fix. *Guard.* Tests and specs only.

**5. X16. Gate mutation audit.**
- *Goal.* A frozen set of hand-written mutants of the write gate, the read filter, retention, promotion and offboarding, each one exact substitution with the one test that must kill it. A script applies each in a scratch copy, runs that test, and reports killed and surviving mutants per invariant. Every invariant has at least one killed mutant; survivors are listed.
- *Source.* plur-ai/plur `.evals/bite.py` (Apache-2.0, `7c6aa73ba14e`, port of its guards: the baseline shows the behaviour, the replace string matches, the mutant loads, the tree is clean); Nestor's mutation guard (Apache-2.0, `Die-Namic-Systems/Nestor` at `d94a5c790bf4`, idea). StrykerJS is not adopted: its spike condition (vitest 5) is unproven.
- *Files.* `research/scripts/gate_mutation_audit.py`, `research/configs/gate-mutation-audit.json`, `fixtures/mutants/` (all new), `research/results/h1-gate-mutation-audit.json` with `"hypothesis": "none"`, `research/results/MANIFEST.md`, `docs/absorbed.md`.
- *Acceptance.* `make test-repro` regenerates the result.
- *Serves.* Part I: the invariants bite. *Risk.* Slow; run locally, never in CI. *Guard.* Mutants live only in a temporary copy; the tree is checked clean after each.

**6. E9.10. `engram discover`.**
- *Goal.* A pure classifier in core of known harness memory locations (Claude Code's auto memory and `CLAUDE.md` files, Codex's `AGENTS.md` and memories, Cursor rules), and a bounded walk in the CLI that reports, per harness and kind, how many such files sit outside every configured store root, with size and modification time and never a byte of content (rule 12). `engram doctor` gains a warning, never a failure.
- *Source.* The research's design (`18a-approval-workflow.md`, AB-GAP1-5 and -6); the vendors' documentation for the locations, each row with its link and a last-verified date. Nothing copied.
- *Files.* `packages/core/src/discover.ts`, `packages/cli/src/discover.ts` (new), `packages/cli/src/commands.ts`, `packages/cli/src/doctor.ts`, `fixtures/harness/home/`, AGENTS.md and CLAUDE.md.
- *Acceptance.* `make test-one T=packages/core/test/unit/discover.test.ts` on the fake home, and a doctor test.
- *Serves.* Gate D: "zero recorded violations" is measured on the plane with the native memory path stated as outside it (item 33); discovery counts what that statement leaves out. *Risk.* Vendors move paths; the table is dated data. *Guard.* New files; no registered path calls them.

### Gate C (W10): after H1's shards are merged

**7. X17. The results page.**
- *Goal.* One self-contained, byte-stable HTML file from `research/results/`: H1's table and figure once they exist, every MANIFEST row with its sha256, command and cost, and the proposed arms' engineering checks marked as such. No dogfood data.
- *Source.* None beyond our hand-written SVG pattern (`research/scripts/h1_figure.py`).
- *Files.* `research/scripts/results_page.py`, `research/configs/results-page.json`, `research/results/h1-results-page.html`, MANIFEST, `Makefile` (`results-page`), AGENTS.md and CLAUDE.md.
- *Acceptance.* `make test-repro` regenerates the page byte for byte.
- *Serves.* Gate C's read-out and its Friday demonstration; X13's reproduction. *Risk.* The page must say a proposed arm's number is exploratory. *Guard.* Reads results, writes one new file.

**8. E1.7. Erasure: close the two gaps the Quint model found.**
- *Goal.* The sweep's put-back (`offboard.ts`, `run`) deletes its record when the item is gone or its scope is being erased, as `commit.ts` `settle`'s `wanted` does. A new write under a swept id is refused as under an erased one, and each purge in `adopt.ts` checks under the lock, just before its delete, that the item has not changed since the refusal. The model changes with the code (`obPutBackRead`), and the scenario tests that pin the gaps become passing tests of the fix.
- *Source.* Our own model; nothing absorbed.
- *Files.* `packages/core/src/plane/offboard.ts`, `adopt.ts`, `write.ts`, `specs/commit.qnt`, `specs/README.md`, the pinning tests.
- *Acceptance.* `make verify-spec`, card E1.8's trace replay, `make test-invariants`.
- *Serves.* Twin's offboarding guarantee; Part I. It precedes the residue check and crypto-shredding, which must not be measured on a leaking erasure. *Risk.* The protocol took five review rounds; the fix takes the same review. *Guard.* No registered condition offboards; every MANIFEST row the write path reaches is rerun.

**9. E2.14. Policy schema: the options this plan's cards need.**
- *Goal.* One schema-only pull request under ADR 0002's decision D2 (additive, optional, no default, absence parsing and serialising byte for byte as before; no `schema_version` bump), with every option cards 15, 16, 19, 22, 24 and 25 need: `lints.model.evidence` (L9), `procedures.safety_scan` (D5), `procedures.drift` (D4), `consent` (E9.12), `erasure.mode` (`redact` or `shred`, E9.13), `approval` (E2.19). Until its card lands, the loader refuses any value but absence or `off`. It also corrects the stale `ContentGuards` and `Trust` comments the backlog records.
- *Source.* None.
- *Files.* `packages/core/src/schema.ts`, `packages/core/src/policy/load.ts`, `make api` outputs, a line in ADR 0002 naming this use of D2.
- *Acceptance.* `make api-check`, `make test`, and the three presets' parsed JSON unchanged.
- *Serves.* Six cards, with one schema change instead of six (rule 5). *Risk.* An option a later card finds it needs is a second schema PR. *Guard.* C3 and C4 embed the parsed policy: the presets' serialisation must not move a byte, so no cassette key moves.

**10. E2.15. Provenance holds across rewrites, closes and imports.**
- *Goal.* Three trust follow-ups in the write path. (a) Finding E14-F3: no grant is added or widened on an item any allowed version of which, or of the source it was promoted from, held content less trusted than `user` (ADR 0021, D4); the oracle already counts it as a violation, so the twin dogfood's report would. (b) Card E9.8's finding: the import cap moves into `Plane.write` for every `import`-sourced actor, so a served client's credential cannot lift it. (c) Card L6's finding: a close that changes only `valid_to` keeps the item's provenance, and the closer is the event's actor. `docs/dogfood.md` limit 4 and its `watch` row are corrected.
- *Source.* None; our own findings.
- *Files.* `packages/core/src/plane/write.ts`, `plane/grants.ts`, `oracle.ts`, `supersede.ts`, `packages/core/test/property/stateful.test.ts`, `docs/dogfood.md`.
- *Acceptance.* `make test-invariants` with E14-F3's counter at zero, and the three cases as tests.
- *Serves.* Gate D's zero recorded violations; the provenance model the thesis rests on. *Risk.* (a) may refuse a grant a GateMem session makes; the card measures it first. *Guard.* Every H1 to H4 MANIFEST row rerun; a rule that moves one becomes a policy option off in the presets.

### Gate C to Gate D (W11 to W13): the research spine

**11. X18. The paired fault-injection check for H3.**
- *Goal.* Proposal U6 built as an engineering check: deletion, temporal-supersession and missing-metadata faults on LongMemEval's 500 bases, at the projection and in the log, with clean, corrupted and enforced reads compared, and `engram log verify` as a column for the log faults. Model-free.
- *Source.* Governance-State Corruption (2610.30698, paper, idea; `docs/readings/litreview/2610.30698-governance-state-corruption.md`).
- *Files.* `packages/bench/src/governance-faults/` (new), `research/scripts/h3_fault_injection.py`, `research/configs/h3-fault-injection.json`, `research/results/h3-fault-injection.json`, MANIFEST.
- *Acceptance.* `make test-repro` regenerates it.
- *Serves.* H3, as a secondary result once the lead registers U6. *Risk.* Projection faults recover by construction; the result says so. *Guard.* New files; B5's fixtures and cassettes unchanged.

**12. X19. The erasure-residue check.**
- *Goal.* Proposal U7 built as an engineering check: 200 exposed and 200 never-exposed canaries over 20 person scopes, every tier searched after offboarding (projection, explanations, event bodies, store records with Letta's git history, the database file's free pages and write-ahead log), the three traces retained by decision reported as such.
- *Source.* AfterDeleteBench (2610.31366) and deployment-time memorization (2606.10062), papers, idea; inspeximus `inspeximus/erasure_residue.py` (MIT, `DanceNitra/inspeximus` at `41a83029aa46`, port of the scan).
- *Files.* `packages/bench/src/residue/` (new), `research/scripts/h3_erasure_residue.py`, its config, `research/results/h3-erasure-residue.json` with `"hypothesis": "none"`, MANIFEST, `docs/absorbed.md`.
- *Acceptance.* `make test-repro` regenerates it on SQLite and embedded Postgres.
- *Serves.* Twin's offboarding claim (ADRs 0010 and 0021), measured before and after crypto-shredding. *Risk.* A residue found is a finding for E9.13, not a fix here. *Guard.* New files only.

**13. E2.16. The content guards: three gaps closed and the oracle taught the stage.**
- *Goal.* Cards E2.9's and D1's follow-ups. The guards scan `provenance.ref` as well as `content`, with a reason naming the field. An adoption deny event records a keyed hash (an HMAC with an injected key) instead of a plain sha256, so a short secret cannot be confirmed by hashing guesses (ADR 0039, decision 4). The secret-name rule matches a name's words, not substrings, so `max_tokens` and `MONKEY` keep their values in bypass reasons. The oracle learns the content-guard stage, so the invariants say something about a policy with the guards on, which proposals P1 and P2 need before registration.
- *Source.* atelya's keyed digests (Apache-2.0, idea); our own findings.
- *Files.* `packages/core/src/policy/secrets.ts`, `plane/bypass.ts`, `plane/adopt.ts`, `oracle.ts`, their tests, `research/configs/secret-guard.json` (limits).
- *Acceptance.* `make test-invariants` with guard-on policies in the generated set; the secret-guard result regenerated.
- *Serves.* Govern; the H1 secondary arms P1 and P2. *Risk.* The word rule changes bypass reasons, which can reach a prompt: after H1's runs, every reachable MANIFEST row rerun. *Guard.* Guards stay off in every preset.

**14. E1.9. The chain on every writer and over attestations; race-free first migration.**
- *Goal.* Card E1.6's three follow-ups. The pi extension's log opener keeps the chain (`keepChain`), as the shared opener does. Each event's attestation digest (card E8.12's `event_attestations`) joins its chain record in the same transaction, under a chain version so existing chains still verify. `migrate` re-reads `schema_migrations` inside each migration's transaction and skips one another process applied.
- *Source.* world-model-mcp's concurrent-append regression and tamper matrix (MIT, `SaravananJaichandar/world-model-mcp` at `c8be3765e87d`, port of the test cases).
- *Files.* `packages/core/src/log/chain.ts`, `log/verify.ts`, `db/migrate.ts`, `packages/pi-extension/src/`, tests, `docs/absorbed.md`.
- *Acceptance.* `make test-invariants` (the chain invariant on both backends) and a two-process first-migration test.
- *Serves.* Every guarantee is read off the log; Govern's audit story. *Risk.* A chain version is a format change; `engram log verify` reads both. *Guard.* Research runs keep no chain by design; nothing they produce moves.

**15. L9. Quote-grounding for the model lints, opt-in.** *A pre-registration amendment if it is to count for H3.*
- *Goal.* With `lints.model.evidence` on, the contradiction and unsupported-claim lints ask for the quoted span behind each flag, and a deterministic check (exact after NFC and whitespace folding, at least 12 characters) downgrades a flag whose quote is not in the items to a judgment that is not a finding.
- *Source.* `scripts/verify_quotes.py` of `eugeniughelbur/obsidian-second-brain` (MIT, `7f4ddfdafa4e`, port).
- *Files.* `packages/core/src/lint/model.ts`, `lint/evidence.ts` (new), `fixtures/faults/model/`, `fixtures/cassettes/l9-grounding/` (scripted), `docs/absorbed.md`.
- *Acceptance.* Unit tests with a scripted lint model; a fixture run replayed with zero new calls; L3's and H3's cassettes unchanged with the option absent.
- *Serves.* H3's model tier, the registered primary test: precision is where grounding helps. *Risk.* It changes the lint prompt when on, so it enters H3 only by an amendment registered before H3's live run (section 8). *Guard.* Option absent everywhere: no prompt changes.

**16. D5. The procedure safety scan at admission.**
- *Goal.* A deterministic scan of a candidate procedure's body and tools for shell injection, destructive commands, exfiltration sinks and prompt-injection phrases. With `procedures.safety_scan: hold`, a critical finding holds the candidate so replay cannot admit it; a warning annotates. A held candidate is released only by a user-sourced actor with a reason.
- *Source.* caura `core-api/src/core_api/services/forge/sentinel_scan.py` (Apache-2.0, `caura-ai/caura` at `8dbb7f40a76c`, the repository the research named `caura-memclaw`; port of the tables as data, NOTICE carried); devmemory's injection heuristics (MIT, `vasikmansuri/devmemory` at `52f0416fc6c5`, idea); Malicious Agent Skills (2602.06547, paper, idea).
- *Files.* `packages/core/src/lint/procedural.ts` (new), `plane/promote.ts`, `fixtures/faults/procedural/`, `docs/absorbed.md`, `NOTICE`.
- *Acceptance.* A test per class with near-miss controls; a fixture corpus with hold and false-hold rates.
- *Serves.* Distill; a replay proves a procedure works, not that it is safe. *Risk.* English-only patterns. *Guard.* Off in H5's configs, so H5's C5 is the registered one.

**17. A6. A fourth store: the MCP reference memory server's JSONL file.**
- *Goal.* An adapter over the knowledge-graph JSONL file of `@modelcontextprotocol/server-memory`, the memory most MCP users run, keeping lines and fields it does not understand, through the conformance suite and ADR 0035's request-identity check.
- *Source.* `modelcontextprotocol/servers`, `src/memory` (version 2.2.1, at `c799c8552b0f`). Its licence is in transition: new contributions are Apache-2.0, older ones MIT until relicensed; both are allowed. Port of the file format; no code copied.
- *Files.* `packages/adapters/src/mcp-memory/` (new), `fixtures/stores/mcp-memory/`, the conformance parametrisation, `packages/cli/src/store.ts`, `docs/absorbed.md`.
- *Acceptance.* The conformance suite on the adapter; a `make test-e2e` CLI smoke.
- *Serves.* H4's store independence as a design property; Govern's reach. *Risk.* Observations carry no ids; the adapter derives stable refs and says how. *Guard.* No registered config names the store.

**18. E2.17. Why not this item.**
- *Goal.* For an item the asker may read, `Plane.explainAbsent` names the first stage that kept it out of a given read (scope, grant, validity, status, the rank cut), from the predicates the read used; for an item out of reach it answers as for a missing one. No event is written. A route, `engram explain --absent`, an MCP tool, `make api`.
- *Source.* caura `core-api/src/core_api/services/recall_explain.py` (Apache-2.0, `8dbb7f40a76c`, idea).
- *Files.* `packages/core/src/plane/explain-absent.ts` (new), `plane.ts`, `packages/server/src/routes.ts`, `packages/cli/src/commands.ts`, `packages/mcp/src/server.ts`, `sdk/`.
- *Acceptance.* A property test: on the simulator's fixtures the named stage equals what `Plane.read` did; a leak test that forbidden and missing answer alike.
- *Serves.* "Every recall can be explained", stated for what was not recalled. *Risk.* An existence oracle; RD1's disclosure rules apply. *Guard.* A new method; reads unchanged.

**19. D4. Drift: re-validation and retirement of admitted procedures (rewritten).**
- *Goal.* Re-run an admitted procedure's replay on its held-out tasks when its environment hash changes or a period passes (`procedures.drift`), seeded and cached like D3's, and retire it by a governed event when it falls below the admission rule, keeping the retired version for rollback. The `replay-drift` and `environment-changed` triggers in `lint.ts` get their producer; crosswalk claim C48 gets its test.
- *Source.* SkillGuard drift (2605.10990), Library Drift (2605.19576) and SKILL.nb's rollback of retired skills (2606.08049), papers, idea.
- *Files.* `packages/core/src/distill/drift.ts` (new), `distill/validate.ts`, `packages/runner/src/replay-validate.ts`, `fixtures/sessions/`, cassettes, `research/configs/crosswalk.json`.
- *Acceptance.* A fixture with a changed task retires the skill, replayed with zero new calls.
- *Serves.* Distill, the roadmap's "core sell"; H5's literature. *Risk.* H5 registers admission, not retirement; drift is off in H5's configs. *Guard.* D3's fixtures and cassettes unchanged.

**20. E2.18. Preset properties proved by Cedar's symbolic compiler.**
- *Goal.* On card E2.12's Cedar export, prove for all requests what the differential test samples: strict never allows a read medium denies, nor medium one permissive denies; a model-sourced write never reaches a person scope it may not; a person's items are never readable by another person without a grant. A failed property prints its counterexample, replayed through `evaluateRead`. A spike on this Windows machine first.
- *Source.* `cedar-policy-symcc` (Apache-2.0, in `cedar-policy/cedar` at `aa121f316da1`; crate 0.8.1, since 0.9.0 of 16 November is under two weeks old; depend, a development tool built with cargo); cvc5 1.4.2 (modified BSD-3, a Win64 release binary; depend, development tool).
- *Files.* `tools/symcc/` (a small Rust binary), `research/scripts/h2_cedar_properties.py`, its config, `research/results/h2-cedar-properties.json` with `"hypothesis": "none"`, MANIFEST, `docs/deps.md`, `Makefile` (`verify-policy`, outside `make test`).
- *Acceptance.* `make verify-policy` proves each property or prints a counterexample the evaluator reproduces.
- *Serves.* Part I: the evaluator's first proofs. *Risk.* Grants are flattened at export, so the proofs hold modulo grants; a counterexample is a finding, fixed by its own card. *Guard.* Development tools only.

### Twin (W11 to W14)

**21. E9.11. Crypto-shredded erasure: the ADR and the key side table.**
- *Goal.* An ADR first (the next free number after 0051), then a side table of per-person data keys in `db/migrate.ts`, with no change to `schema.ts`, and an injected key provider so core does no key I/O. The ADR settles how shredding sits beside ADR 0038's chain (the salted commitments stay) and decision 38a (a separate, never-shredded hash keeps re-adoption refused).
- *Source.* Compartment `src/compartment/crypto.py` (Apache-2.0, `98d4917181c0`, port of the design: per-record keys wrapped under a master key, the record id as associated data, bounded KDF parameters); `docs/readings/litreview/methods-crypto-shredding.md`.
- *Files.* `docs/decisions/<next>-crypto-shredded-erasure.md`, `packages/core/src/db/migrate.ts`, `packages/core/src/crypto/keys.ts` (new), tests, `docs/absorbed.md`.
- *Acceptance.* `make lint-docs`; the migration on SQLite and Postgres; a key-provider test.
- *Serves.* Twin; the first plan's section 7 named it the first thing after the thirty. *Risk.* Key custody is the operator's; the ADR says what is not protected. *Guard.* No item or event changes shape.

**22. E9.12. Do not record: consent at the write gate for the person scope.**
- *Goal.* A person declares opt-outs (a topic, a source, or everything for a window); an allowed write never matches an active opt-out, and a matching write is denied with a reason that names the rule and never the content. Incognito is this rule with a window.
- *Source.* EverOS's `do_not_record` with carve-outs (Apache-2.0, `EverMind-AI/EverOS` at `e594efe59cc6`, `src/everos/memory/models.py`, port).
- *Files.* `packages/core/src/policy/consent.ts` (new), `policy/evaluate.ts`, `packages/pi-package/profiles/twin.yaml` (an example, off), a property test, `docs/absorbed.md`.
- *Acceptance.* A property test: no allowed write matches an active opt-out.
- *Serves.* Twin. *Risk.* A recorder or framework adapter writing on a person's behalf must pass the person's id. *Guard.* Off in every preset.

**24. E9.13. Crypto-shredded erasure in offboarding.**
- *Goal.* With `erasure.mode: shred`, a person scope's content is sealed under its key on write (Engram-written stores and log bodies), and offboarding destroys the key and records it; the residue check (X19) runs before and after. Redaction stays the default.
- *Source.* `packages/remnic-core/src/secure-store/cipher.ts` of `joshuaswarren/remnic` (MIT, `01adfceedee8`, copy: AES-256-GCM over `node:crypto`, scrypt, no new dependency, notice kept).
- *Files.* `packages/core/src/crypto/seal.ts` (new), `plane/write.ts`, `plane/offboard.ts`, the files adapter's wrapper, tests, `docs/absorbed.md`, `NOTICE`.
- *Acceptance.* `make test-invariants`, and X19's result regenerated under shred.
- *Serves.* Twin's erasure claim, measured. *Risk.* Mem0 and Letta keep their own copies; the guarantee is stated per store. *Guard.* Default redact; no registered byte moves.

**26. E9.14. The signed erasure receipt, with residue verification.**
- *Goal.* `engram erase --receipt` writes an Ed25519-signed, content-free receipt of an offboarding (targets, results, what was retained by decision, a Merkle root over the redaction manifest), and `engram verify-receipt` rereads the stores and the log, answering unchecked, valid or invalid, and naming what it cannot prove.
- *Source.* `lethe/receipt.py` of `deeplethe/lethe` (MIT, `b6053b7bdacc`, last pushed 16 June 2026, port); inspeximus `inspeximus/deletion_manifest.py` (MIT, `41a83029aa46`, port).
- *Files.* `packages/core/src/receipt.ts` (new), `packages/cli/src/` (reusing `signing.ts`), tests, `docs/absorbed.md`.
- *Acceptance.* Tamper cases (an edited receipt, a flipped hash, a swapped key, a truncated tail) all detected.
- *Serves.* Twin; GDPR Article 17 evidence in the crosswalk. *Risk.* A store that cannot be reread gives "unchecked", never "valid". *Guard.* New commands only.

### Govern (W12 to W16)

**23. E8.17. Codex under the gate.**
- *Goal.* Codex now has hooks with generated input and output schemas (`codex-rs/hooks/schema/generated/pre-tool-use.command.input.schema.json` and its output). `engram hook codex` decides with the same core shell and path checks as the Claude Code hook; `engram hook install claude-code|codex` merges its entry into the harness's settings idempotently and tracks its own command strings. ADR 0022's "Codex has no hook" is amended.
- *Source.* `openai/codex` (Apache-2.0, `ebd0765aafa2`; copy of the two schemas as test fixtures, notice kept); obsidian-second-brain's idempotent installer (MIT, idea).
- *Files.* `packages/mcp/src/hook.ts`, `packages/cli/src/hook.ts`, `packages/cli/src/setup.ts`, `fixtures/harness/codex/`, ADR 0022, `docs/absorbed.md`, `NOTICE`, AGENTS.md and CLAUDE.md.
- *Acceptance.* `make test-e2e` with a Codex hook case validated against the copied schemas.
- *Serves.* Codex is one of the two supported harnesses, and no store command on its path is blocked today. *Risk.* The schema moves; the fixtures are pinned to the commit. *Guard.* H4's harness claim stays untested (item 25).

**25. E2.19. The approval queue.**
- *Goal.* The review queue as a pure projection over the log: a request is the `gate` event with decision `ask` that `promote.ts` already appends, resolved by a later promote allow or deny, keyed by the candidate's id and version, so no event field is added. The `approval` block routes a scope's requests to named approvers (the owner, a role, a list), sets an expiry after which the request is denied by a recorded event at the injected clock, and refuses self-approval. A new invariant: no candidate becomes active without an allow by a routed approver.
- *Source.* `obsidian_wiki/staging.py` of `Ar9av/obsidian-wiki` (MIT, `7da8def05ab4`, port of held-write staging with a stale-base refusal); the research's design (`18a-approval-workflow.md`).
- *Files.* `packages/core/src/plane/approvals.ts` (new), `policy/promotion.ts`, `plane/promote.ts`, a property test file of its own, `docs/absorbed.md`.
- *Acceptance.* `make test-invariants` with the new invariant (the lead-owned invariants file is not edited).
- *Serves.* Govern's trusted organisational memory, and Gate D's Knowledge dogfood (item 28): under the knowledge profile every team and org write is a candidate, so someone has to see the queue. *Risk.* ADR 0026's reviewer rules and E9.9's owner acceptance must compose; the card waits for E9.9. *Guard.* No registered config promotes.

**27. E8.8. Approvals on every surface and the inspector's queue (rewritten).**
- *Goal.* Routes, `engram review list|approve|reject`, MCP tools, and the inspector's queue screen with each request's item, routing and expiry; approve promotes, reject retires. The inspector gains a credential so it can call an authenticated server (card E8.12's finding).
- *Source.* None beyond the inspector's existing dependencies.
- *Files.* `packages/server/src/routes.ts`, `packages/cli/src/commands.ts`, `packages/mcp/src/server.ts`, `packages/ui/src/`, `sdk/`, AGENTS.md and CLAUDE.md.
- *Acceptance.* `make api-check` and `make test-e2e` (Playwright: approve writes a promote event, reject a retire event).
- *Serves.* Govern; the card the first plan's section 7 relied on. *Risk.* The TUI will want a screen; a `finding` tells branch `cliupgrade`. *Guard.* Surfaces only.

**28. E2.20. Policy as code.**
- *Goal.* `engram policy test <file>`: a YAML file of cases (actor, item, time, expected decision and rule) run against a policy, explained on failure, with a starter suite per preset. `engram policy diff --candidate <file> [--ceiling <file>]`: a structural diff that fails when the candidate widens what the ceiling allows. Both through a route and the generated client.
- *Source.* `opa test` (Apache-2.0, `open-policy-agent/opa` at `68244323f5a4`, idea) and Cerbos's policy tests (Apache-2.0, `cerbos/cerbos` at `5424d0a363ca`, idea).
- *Files.* `packages/core/src/policy/cases.ts` and `policy/diff.ts` (new), `packages/server/src/routes.ts`, `packages/cli/src/commands.ts`, `packages/pi-package/profiles/tests/`, `sdk/`.
- *Acceptance.* `make api-check` and the starter suites passing.
- *Serves.* Govern: authors test policy without TypeScript; the presets become executable documentation. *Risk.* Overlap with `engram simulate`; this stays at the decision level. *Guard.* New commands only.

**29. E9.15. The signed audit report.**
- *Goal.* `engram audit export --from --to` writes a content-free statement (event counts by decision and rule, the chain head and checkpoint, the policy's hash, the schema version, the oracle's result over the window) in a DSSE envelope with an in-toto Statement, signed with the operator's key; `engram audit verify` checks it against the log.
- *Source.* DSSE (Apache-2.0, `dsse-lf/dsse` at `75a79b6ed61c`, moved from `secure-systems-lab/dsse`; port of the envelope, no dependency); in-toto's Statement layout (Apache-2.0, `in-toto/attestation` at `50bf01716982`, port).
- *Files.* `packages/core/src/audit/` (new), `packages/cli/src/` (reusing `signing.ts`), tests, `docs/absorbed.md`.
- *Acceptance.* Verify passes on a fixture log; a tampered statement and an edited log both fail.
- *Serves.* Govern's audit artefact; the crosswalk's evidence rows. *Risk.* Rule 12: content-free by construction and tested so. *Guard.* New commands only.

**30. E9.16. The subject access export and the Article 30 record.**
- *Goal.* `engram export --subject <person>` gives a person what the plane holds about them, through `Plane.read` as that person and card E9.8's bundle, with a closure report of derived items in other scopes (ids where the person may see them, a count otherwise); `engram audit ropa` prints a record of processing per scope from the policy. The documents say it is evidence, not certification.
- *Source.* The Article 30 field list (Regulation (EU) 2016/679). CIRCL/compliance and gdprropa are AGPL and GPL and are read for ideas only.
- *Files.* `packages/core/src/portable.ts`, `packages/core/src/audit/ropa.ts` (new), `packages/cli/src/commands.ts`, `docs/compliance/`, `research/configs/crosswalk.json`.
- *Acceptance.* A round-trip test of the subject export and a fixture record.
- *Serves.* Twin and Govern; GDPR Articles 15, 20 and 30 in the crosswalk. *Risk.* Derived items out of reach appear only as a count. *Guard.* New commands only.

## 6. Waves and parallelism

The waves follow the calendar; inside a wave, cards run at once unless they share a file named below. Four cards regenerate the generated contracts with `make api` (E2.14, E2.17, E8.8, E2.20): they merge one at a time, each rebased on the last and regenerated after it.

| Wave | Weeks | Cards | Run together? |
|---|---|---|---|
| 0, before the tag | W8 (to 29 Nov) | E0.6, E0.7 | Yes: `scripts/` files apart; E0.6 alone edits the Makefile. |
| 1, during H1's runs | W9 (30 Nov to 6 Dec) | E8.16, E1.8, X16, E9.10 | Yes. E8.16 starts once RD1 merges. Shared files: the Makefile (E1.8 only), MANIFEST (X16 only), AGENTS.md and CLAUDE.md (E9.10 only). |
| 2, Gate C | W10 (7 to 13 Dec, after H1's `MERGE=4`) | X17, E1.7, E2.14, E2.15 | X17 and E2.14 with anything. E1.7 waits for E1.8 and merges before E2.15: both edit `plane/write.ts`. |
| 3 | W11 | X18, X19, E2.16, E1.9, E9.11 | X18, X19 and E2.16 together (MANIFEST rows are additive). E1.9 before E9.11: both add a migration to `db/migrate.ts`. E2.16 after E1.7 and E2.15 (`adopt.ts`, `oracle.ts`). |
| 4 | W12 | L9, D5, A6, E2.17, E9.12, E8.17 | Yes. Only E2.17 runs `make api`. D5 edits `plane/promote.ts`, which E2.19 edits next wave. |
| 5 | W13 | D4, E2.18, E9.13, E2.19 | D4, E2.18 and E2.19 together. E9.13 waits for E9.11 and X19, and for E2.15 in `plane/write.ts`. |
| 6 | W14 | E9.14, E8.8 | Yes. E8.8 runs `make api`. |
| 7 | W15 to W16 | E2.20, E9.15, E9.16 | E2.20 after E8.8 (`make api`). E9.15 and E9.16 share `packages/core/src/audit/`: E9.15 first. |

Friday demonstrations the plan adds: W9, a leak probe through every surface coming back clean, and a Quint trace replayed on the real Plane; W10, Gate C's table on the results page; W11, a log fault detected by `engram log verify` inside the fault-injection check; W12, a Codex shell command naming a store blocked by the hook; W13, a procedure retired on drift and a queue of approvals routed to their approvers; W14, an offboarding with its signed receipt verified, and the residue check before and after shredding.

**Cost.** At the roadmap's rates (S 0.25, M 0.5, L 1.0 FTE-week) the thirty come to 15.25 FTE-weeks: 9.25 on the research lane and 6.0 on the product lane. The roadmap's own tables cannot hold that at their rates; as for the first plan, the plan rests on the pace observed (the first thirty merged in four days). Re-estimate at Gate C. If H1 needs the team, the product lane waits first, in the cut order of the roadmap.

## 7. What is left out, and why

- **Work that is not absorb work.** The pre-tag conditions still open, the request-identity check Gate D rests on, and the Knowledge dogfood card are named in section 9, not planned here: the lead asked for absorb work, and they must not wait for it.
- **Anything that bumps `schema_version`** (R-068 to R-071 derived-from edges and their lints, R-072 the read manifest, R-074 and R-075 taint rules, R-076 an approval request id, R-092 and R-093 outcome events, R-099 and R-100 recency per class, R-101 to R-103 the policy hash on events, R-106 the dense tier, R-123, R-125, R-144). A bump moves H1's cassette keys after H1 has run, and H3's pinned fault-set hashes before H3 runs (section 3). Each waits for an ADR that separates the policy's version from the item and event version, or for side-table designs like E9.11's; neither is urgent before Gate D.
- **Changes to what a registered condition sees.** Datamarking and session taint (R-046, R-047, R-116, R-117; proposal U1) change C5's memory tag; the dense tier (R-066, R-107 to R-110; U2) changes retrieval; the Distiller prompt wrapper (R-045) changes ADR 0045's prompt; recording sessions under the guard (card D1's follow-ups) changes H5's input after H5's design is fixed; the lineage-as-revocation question of card A5 and the text-read question of card E8.14 change registered reads. Each is an amendment, so each is the lead's, and none is pressing.
- **A second small-model tier, the injection classifier (R-158).** Card L7 found that its NLI scores did not separate contradictions from unrelated pairs on the fixture; a second tier of that kind should wait for proposal P2's registration and a tested premise.
- **Frameworks and MCP's next version** (R-136, R-137, R-141 to R-143). Card E8.14 built the kit; the LangGraph and Mastra adapters and the MCP SDK version 2 migration widen reach, serve no hypothesis, and the migration risks the surface H4 names. After Gate D.
- **The hot paths card X15 measured.** Whole-table scans and the read-history scan in the budget check are a production problem, and the fix touches the load-bearing read and write paths while the frontier runs (X6 to X8) depend on them. After the frontier runs.
- **Delegation for sub-agents** (R-016, R-049, R-129). No hypothesis depends on it, and the research itself recommends waiting until a test shows the log cannot say on whose behalf an agent acted.
- **Operations and reach that a member can do by hand:** log backup and tail (R-060; a member copies the file, and the chain verifies the copy), retention preview, templates and the kill switch (R-112 to R-114), the AI-BOM, OSCAL, OpenLineage and Parquet exports (R-061, R-132, R-161, R-166), a Python client and docs site (R-165, the roadmap's W23).
- **Methods that need live calls or a later premise:** the retrieval bisect (R-036; real failures exist only after live runs), quote-grounding's deterministic sibling for unsupported claims (R-126, after L9), population and usage lints (R-124), the cross-family guard (R-097; the three model slots already come from three makers), ForgetEval (R-118, U5; the residue check comes first), memory-system baselines (R-152 to R-154), skills import and export (R-155 to R-157).
- **Ingestion and consolidation** (R-144 to R-151): parked after Gate D by the research, and the 2026 evidence is that model-written consolidation often degrades memory.
- **The injection screen on adopted records** (backlog, finding E2.10-4). Decided here: it stays as built until proposal P2 is registered, since the screen is off in every preset and the question is the arm's.

All of these stay candidates in `docs/research/absorb/long-list.md`.

## 8. Questions for the lead

Only money and the pre-registration go to the lead; everything else in this plan was decided, with its reason, in the decision entries of 2026-11-25 (`docs/log/2026-11-25-ap2-*`).

1. **Money: the programme-wide spend cap (item 59, pre-tag condition 7).** The runner card that enforces the cap in billed dollars is not on main and has no card file, five days before the tag. Either a card is written and merged before 30 November (outside this plan), or the operator's fallback in the pre-tag condition (reading OpenRouter's credit balance at least every two hours and stopping the shards below the margin) is how H1 is capped. Recommendation: the fallback for H1, the card in W10 before any later live run.
2. **Pre-registration: quote-grounding for H3 (card L9).** Register it, by amendment before H3's live run (card X10, W17), as a variant of H3's model tier, or keep it an engineering check. Recommendation: decide from L9's fixture result, read once and not tuned.
3. **Pre-registration: the arms U6 and U7 (cards X18 and X19).** Register either as a descriptive arm once its engineering check is merged, or keep both as checks. Recommendation: register U7, since it is the only measured evidence for Twin's offboarding claim; keep U6 a check unless H3's primary test is undecided.
4. **Pre-registration: H5's prerequisites (item 30).** By item 9 they are fixed before H1's data exist, and no draft is on main. Cards D4 and D5 assume H5's configs as registered, with drift and the safety scan off; that assumption holds whatever the prerequisites say, but the prerequisites themselves are owed before 1 December.

## 9. Follow-ups the thirty close, and work they do not own

The first wave's follow-ups that rank among the thirty, with where each was recorded:

| Follow-up | Recorded in | Card |
|---|---|---|
| The register's check (ADR 0037, decision 8) | backlog, "Follow-ups from the absorb plan" | E0.6 |
| Crosswalk C44, injected time | backlog, card R4's follow-ups | E0.7 |
| Tests that break only under `ENGRAM_OFFLINE=1` | `docs/log/2026-11-22-l7-failure-tests-under-offline.md` | E0.7 |
| A surface-level suite | `docs/log/2026-11-21-x14-finding-not-covered.md` | E8.16 |
| The sweep's put-back leak; the purge race on swept ids | backlog, card E1.5's follow-ups | E1.7 |
| Stale `ContentGuards` and `Trust` comments in the schema | backlog, the README overhaul's follow-ups | E2.14 |
| Grants on laundered agent content (E14-F3) | backlog, card E1.4's follow-ups | E2.15 |
| The import cap and a served credential | `docs/log/2026-11-22-e9-8-finding-credential-source-replaces-cap.md` | E2.15 |
| A close turns a person's fact into a model's | `docs/log/2026-11-22-l6-finding-close-provenance-trust.md` | E2.15 |
| The guard scans `content` only; the unkeyed hash; the secret-name over-match | backlog, cards E2.9's and D1's follow-ups | E2.16 |
| The oracle does not know the content-guard stage | `docs/log/2026-11-21-e2-9-finding-oracle.md` | E2.16 |
| Attestations outside the chain; handles that keep no chain; the first-migration race | backlog, the README overhaul's follow-ups; `docs/log/2026-11-21-e1-6-finding-unkept-writers.md` | E1.9 |
| Crosswalk C48, procedure drift | backlog, card R4's follow-ups | D4 |
| The inspector has no credential | `docs/log/2026-11-21-e8-12-finding-inspector-and-forwarding.md` | E8.8 |
| Crypto-shredded erasure, "the first thing to add after the thirty" | `docs/tasks/absorb-plan.md`, section 7 | E9.11, E9.13 |

Work the gates need that no card owns, found while planning (`docs/log/2026-11-25-ap2-finding-gate-work-unowned.md`): pre-tag conditions 2 (the audit configs' `on_stop`), 3 (items 14 and 15), 5 (the OpenRouter endpoints) and 7 (the spend cap); H5's prerequisites (item 30); Gate D's request-identity check (ADR 0035, decision 1) and the Knowledge profile's dogfood (item 28); and before H3's live run, the contradiction prompt's change (item 44). Each needs its own card, written by the orchestrator, not by this plan.

## 10. How the cards are worked

As every card: `docs/tasks/<id>.md`, a plan in the pull request before code, the acceptance test first, an independent review, a fix pass and a verification, the local gates (`make lint`, `make lint-docs`, `make test`, `make test-invariants`, `make api-check`, `make test-e2e`, and `make test-repro` for every MANIFEST row the change can reach), and log entries for each deliverable, decision and failure. A card that copies or ports adds its rows to `docs/absorbed.md` and `NOTICE` in the same pull request, and rereads the licence at the commit it takes from. A card whose change the terminal interface would show writes a `finding` for branch `cliupgrade`.
