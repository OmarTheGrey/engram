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

Existing cards the plan rewrites: D4 (open since the roadmap; unblocked by D3) and E8.8 (open; it now carries the approval surfaces). All others are new. Follow-ups of the first wave that the thirty close are listed in section 6.
