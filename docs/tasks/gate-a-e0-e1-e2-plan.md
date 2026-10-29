# Plan: finish Gate A and the remaining E0, E1 and E2 cards

Status: proposed by the orchestrating session on 2026-10-29, for the lead's review. Six PRs at most, this one included. Each PR follows AGENTS.md and the two conventions; rule 10 (one card per PR) is set aside for them as it was for PRs #2 to #7 (`docs/log/2026-10-25-six-prs-for-the-next-cards.md`).

## 1. Where the repository stands

Verified on main `ffb05bc` (2026-10-29), every gate green.

| epic | card | state | where |
|---|---|---|---|
| E0 | E0.1 monorepo | done | S0.1 |
| E0 | E0.2 schema | done | S0.7, `make api-check` |
| E0 | E0.3 interfaces | done | PR #2 |
| E0 | E0.4 compose, SQLite dev path, `engram doctor` | open; doctor exists with three checks skipped (provider keys, pins, letta) | this plan, PR 3 |
| E0 | E0.5 AGENTS.md, PR template | done | S0.2, S0.3 |
| E1 | E1.1 event log | SQLite done (S0.8); Postgres backend open | this plan, PR 2 |
| E1 | E1.2 item store by store_ref | done | PR #2 |
| E1 | E1.3 replay at any seq | done | PR #2 |
| E2 | E2.1 policy loader and presets | done | PR #3 |
| E2 | E2.2 read path | done | PR #5 |
| E2 | E2.3 write path | done | PR #5 |
| E2 | E2.4 retention | open | this plan, PR 4 |
| E2 | E2.5 promotion | open | this plan, PR 5 |
| A | A1, A3, A4 | done | PR #4, PR #6 |
| B | B1 GateMem | pipeline done, acceptance (live numbers) open | this plan, PR 6 |
| E8 | E8.2 CLI | Gate A slice done; promote lands with E2.5 | PR #6, this plan PR 5 |
| PX, RN | PX1, RN1 | done | PR #7 |

Gate A (roadmap, end of week 2) against the code:

| criterion | state | evidence |
|---|---|---|
| schema generates JSON Schema and types with no diff on a clean tree | pass | `make api-check` in CI |
| pre-registration v0 committed and dated | pass; v1 is backlogged | tag `prereg-v0`, `docs/research/preregistration.md` v0.2 |
| GateMem and MPBench run end to end on their own reference agents from pinned commits | partial | GateMem: the Long-Context reference agent runs on the vendored 20-checkpoint subset with a scripted model (`make bench BENCH=gatemem`); its judge is not ported and the live run against the paper's numbers is a paid call that waits for the pre-registration (`docs/tasks/backlog.md`). MPBench: no release; backlogged with card BF1 as the fallback |
| the files adapter shows a team member's Claude Code memory in the CLI | pass for the owner; the other members have not run it | `docs/log/2026-10-25-e8-2-cli-read-write-doctor.md` |

So Gate A cannot pass as written without a decision. The roadmap's fail response is to extend phase 0 by a week; the backlog decision of 2026-10-22 already deferred both missing pieces. This plan does everything on the two partial criteria that needs no paid call and no pre-registration (the judge port with cassettes, the doctor's pin and key checks, the dogfood record), and asks the lead to declare Gate A passed with two recorded exceptions or to extend phase 0 (decision 1 below).

## 2. Decisions the lead makes before or during the work

1. **Gate A.** Declare it passed with two recorded exceptions (GateMem live numbers when the pre-registration leaves the backlog; MPBench replaced by BF1 or MEM-INV-Bench, dated) or extend phase 0. PR 6 writes the record either way.
2. **E1.1 Postgres.** The `Db` interface is synchronous (`transaction` takes a synchronous body; the read path takes the projection in one synchronous step; the write queue relies on it) and Node has no synchronous Postgres driver. Three ways out:
   - (a) **Recommended.** A Postgres `Db` whose statements run on a worker thread holding the connection, the main thread waiting on `Atomics.wait` (the synckit pattern). Core does not change; `Db.transaction` keeps its contract (BEGIN, SAVEPOINT, RELEASE, ROLLBACK TO run as statements on the same connection). Cost: one file in `packages/core/src/db/`, one dependency (`postgres`, postgres.js, Unlicense; or `pg`, MIT), a Postgres service in CI and in compose. Risk: a hang if the worker dies mid-statement, bounded by a timeout that throws.
   - (b) Defer Postgres until a surface needs a shared log (E8.1 with several users): amend ADR 0003 and the card, keep the `Db` contract tests of PR 2 so the swap stays testable. Lowest risk; the card closes as "deferred", not done.
   - (c) Make `Db` asynchronous end to end. Touches every function that takes a `Db`, the read snapshot and the write queue. Not recommended before Gate B.
3. **What a confirmation is** (E2.5). Proposed: an allowed write, in the same scope, of an item whose content hash equals the episodic item's, from a different provenance (`ref` or `session_entry_id`); confirmations are counted from the log, never stored.
4. **Who may review** (E2.5). Proposed: a member of the target scope who is not the item's owner; the promote event records the approver as its actor.
5. **Who runs retention and as whom** (E2.4). Proposed: `Plane.retain(actor, scope, at)`, called by the pi extension after an allowed write to that scope and at `before_agent_start`, and by `engram read` before adoption; the actor is the session's or the CLI's, and must be a member of the scope.
6. **MPBench.** BF1 (reconstruction), MEM-INV-Bench, or wait for the authors; dated in `packages/bench/PINS.md`. Not in these six PRs unless taken off the backlog.

## 3. The six PRs

Order: PR 1 now. PR 2, PR 4 and PR 5 in parallel on main (PR 5 stacks on PR 4, since both edit `plane.ts` and `plane/write.ts`). PR 3 on PR 2. PR 6 last, on PR 3. Each PR: acceptance test first, implementation, mutation checks on the critical rules, log entries per card and per failure, ADR amendments in the amendment lists with status lines unchanged, and an independent review before merge as for PRs #2 to #7.

### PR 1. Phase 0 close-out (this PR)

Cards: none (bookkeeping). Updates the status line of every card PRs #2 to #7 delivered, records the merge as a milestone, and commits this plan. Acceptance: `make lint-docs`; `scripts/test/tasks-and-decisions.test.ts`.

### PR 2. E1.1: the Postgres backend behind the `Db` interface

Depends on decision 2. Written for option (a); under (b) the PR keeps items 1 and 4 only.

1. `packages/core/test/db/contract.ts`: the `Db` contract as a suite any backend must pass: exec, prepare with every `Param` type, `run` changes, `get` and `all` row shapes, nested transactions as savepoints, rollback on throw, the synchronous-body rule, and the whole of `events.test.ts`, `items.test.ts` and the replay tests run through a factory. SQLite passes it first (red on a deliberately broken fake backend, then green).
2. `packages/core/src/db/postgres.ts`: `openPostgres(url)` on a worker thread (`node:worker_threads`, `SharedArrayBuffer`, `Atomics.wait` with a timeout that throws `DbTimeoutError`); one connection per `Db`; `BEGIN`, `SAVEPOINT`, `RELEASE`, `ROLLBACK TO` as statements; placeholders rewritten from `?` to `$n`; `bigint` and `Uint8Array` mapped; the migrations run unchanged, with any SQLite-only syntax (`ON CONFLICT ... DO UPDATE`, `PRAGMA`) moved behind the `Db` (a `dialect` field or per-backend migration text, whichever keeps the migrations one list).
3. CI: a `postgres:17` service container; the contract suite runs on both backends when `ENGRAM_PG_URL` is set and skips Postgres cleanly otherwise, printing why. Locally the compose of PR 3 provides it.
4. ADR 0003 amendment: which backend holds which log (per-user SQLite by default; Postgres when configured), the worker design and its timeout, and that the two backends pass one contract.
5. `docs/deps.md` row for the driver, exact-pinned.

Acceptance: `pnpm --filter core exec vitest run test/db` on both backends; `make test` green; `make test-invariants` 4 passed. Out of scope: any surface reading the URL (PR 3).

### PR 3. E0.4: compose, the SQLite dev path, a complete `engram doctor`, `make test-e2e`

1. `docker-compose.yml` with a `postgres` service (volume, healthcheck) now; the `server` and `ui` services are added by E8.1 and E8.5, and the file says so. `.env.example` with `ENGRAM_DB_URL` and the provider key names the doctor checks.
2. The CLI and the extension accept `ENGRAM_DB_URL` (or `--db postgres://...`) and open the matching backend through one `openDb(target)` in `packages/cli/src/setup.ts`; the default stays `<home>/.engram/engram.db` (decision D9).
3. `engram doctor` checks, each with a line and a reason: the log (opens, migrations current, backend named); the policy (loads, preset or path); the store root; adapters (files opens the root; Mem0 opens an in-memory instance offline with the hashing embedder; letta still skipped, card A2); provider keys (for each provider pi-ai names, whether its key variable is set, from pi-ai's own table through the runner's model layer, never by reading the key's value, no network); benchmark pins (`packages/bench/PINS.md` parses, every vendored fixture's hash matches `fixtures/bench/gatemem/manifest.json`). `doctor` still never creates a log.
4. `make test-e2e` (layer 6): `docker compose up -d postgres`, `engram doctor` on SQLite and on Postgres, a CLI smoke (write, read, explain on a temp folder) on both; the MCP handshake step is added by E8.4. Runs on main and nightly, not on every PR.
5. AGENTS.md: the `engram doctor` and `make test-e2e` lines; CLAUDE.md identical.

Acceptance: `make test-e2e` green locally; `pnpm --filter cli test` with a doctor test per check, each shown red by removing the thing it checks. Out of scope: the server and the UI.

### PR 4. E2.4: retention

1. `packages/core/src/policy/retention.ts`: a pure `evaluateRetention(policy, scope, items, at, usage)` returning the retirements a sweep would make, each with a reason and a policy id (`<policy>/retention/<level>/<class>`): ttl expiry (`valid_from` plus `ttl` not after `at`, compared with the full-precision helper) as op `retire`; budget overage (active items of the class in the scope above the rule's budget) as op `evict`, choosing by the rule's eviction: `recency` retires the oldest by last changing event, `utility` the least read (the count of explanation rows naming the item, from migration 3, ties by recency), `manual` retires nothing and reports the overage. No clock, no randomness, no store I/O.
2. `Plane.retain(actor, scope, at) -> RetentionReport` in `packages/core/src/plane/retention.ts`: the actor must be a member of the scope (`engram/retention/membership`); every retirement is one event mirrored to the pi session; retired items stay in the store (ADR 0010); the report lists what it did and what `manual` left over. Runs inside the write queue so it never interleaves with a write.
3. The write path runs the budget check for the written scope and class after a landing write, in the same queue slot, so a scope never holds more active items of a class than its budget after any write sequence.
4. Surfaces: the extension calls `retain` after an allowed write and at `before_agent_start` for the session's scopes; `engram read` calls it before adoption. Events show in `engram explain` and the session as every other event does.
5. The lead-owned invariants: a fifth property, "after any write sequence, no scope holds more active items of a class than its budget, every retire or evict event carries a reason and a policy id, and replay reproduces it"; second reviewer and a `decision` log entry as before.
6. ADR 0010 amendment (the two ops, the utility signal, `manual`); preset comments say the ttl and budget numbers are proposed values; a `fixtures/sessions/` session where a write evicts, regenerated by `make fixtures`.

Acceptance: `pnpm exec vitest run packages/core/test/unit/policy/retention.test.ts packages/core/test/unit/plane/retention.test.ts`: budget exceeded evicts per policy under all three modes, ttl expiry retires, events recorded and replayable; `make test-invariants` 5 passed. Mutation checks: each mode, the membership check, the budget boundary.

### PR 5. E2.5: promotion

Stacks on PR 4. Depends on decisions 3 and 4.

1. `packages/core/src/policy/promotion.ts`: a pure `evaluatePromotion(policy, actor, item, target, evidence)` where `evidence` is `{ confirmations: number, review: boolean, validation?: { k: number, n: number } }`. Episodic to semantic: allowed when `confirmations >= policy.promotion.episodic_to_semantic.confirmations`, or when `review` and `or_review` and the actor may review; procedural candidate to active: allowed when `validation.k >= replay_k` with `validation.n >= replay_n`, denied otherwise (the replay gate of D3 supplies the record later); a scope widening is evaluated as a write under the target scope's rule (membership, sources, classes, floor, review), so a promotion never lands where a write could not. Policy ids: `<policy>/promotion/episodic-to-semantic`, `<policy>/promotion/review`, `<policy>/promotion/procedural`, `engram/promote/membership`, `engram/promote/not-candidate`, `engram/promote/no-evidence`.
2. `Plane.promote(actor, itemId, toScope, at)` in `packages/core/src/plane/promote.ts`: counts confirmations from the log (decision 3), decides, and on allow appends the `promote` event carrying the item as it now stands. A status-only transition (candidate to active) is in place: same id, version plus one. A class or scope change is a new id whose lineage names the source, and the source is retired by a second `retire` event in the same queue slot (ADR 0005, decision D1); the store is written through the adapter for the new version. `ask` when `requires_review` holds and the actor is not a reviewer; `GateResult.item` is null then.
3. `engram promote <item-id> --to <scope> [--review]` in the CLI (one Plane call, exit 0, 1 on deny, 2 on usage); `memory_promote` is not added to the pi tools (the architecture lists four), the pi command `/engram promote` can wait for PX2.
4. The invariants: invariant 2's oracle gains promotion (a promoted item never lands where the oracle forbids a write of it); the generators produce confirmation sequences and reviews; second reviewer and a `decision` entry.
5. ADR 0011 amendment: confirmations, reviewers, in-place versus new-version transitions; the preset comments say `confirmations`, `replay_k` and `replay_n` are proposed values.

Acceptance: `pnpm exec vitest run packages/core/test/unit/policy/promotion.test.ts packages/core/test/unit/plane/promote.test.ts packages/cli/test/promote.test.ts`: a fixture promotes only after k confirmations, the review path records the approver, a procedural candidate without a validation record stays candidate; `make test-invariants` 5 passed. Mutation checks: the k boundary, the owner-as-reviewer rule, the widening-as-write rule.

### PR 6. Gate A: the GateMem judge, the dogfood record, the gate decision

1. B1: vendor `bench/prompts/judge_prompt.txt` from the pin (MIT, with `UPSTREAM-LICENSE`); `packages/bench/src/gatemem/judge.ts` builds the judge call as a `ModelCall` with the paper's settings (`gpt-4o`, temperature 0) and parses its verdict the way `score_predictions.py` does; `make bench BENCH=gatemem` reports the rule-based scores as now and, when judge cassettes exist, the judge scores; in tests the judge is scripted and a golden file holds its verdicts on the 20 checkpoints. The live run (reference numbers within tolerance) stays a dated item in the card, blocked by the pre-registration; the tolerance is set there.
2. The reference agent on the full checkpoint set in dry-run mode: `make bench BENCH=gatemem DRY=1` lists how many model calls the live run would make and at which cache keys, so the cost is known before the pre-registration leaves the backlog.
3. Dogfood: `docs/dogfood.md` with one row per member (date, memories adopted, filtered, denied; counts only, AGENTS.md rule 12) from `engram read --root <their folder> --owner <id>`; a human step for each member.
4. The Gate A record: a `milestone` log entry with the four criteria, their evidence, and the lead's decision 1; `docs/tasks/B1.md`, `B2.md`, `BF1-mpbench-fallback.md` and `backlog.md` updated with the dated MPBench decision (decision 6).

Acceptance: `pnpm --filter bench test` (judge parsing against the golden verdicts; dry-run counts); `ENGRAM_OFFLINE=1 make bench BENCH=gatemem` green. Out of scope: any paid model call; the pre-registration.

## 4. What this plan does not do

- Pre-registration v1, MPBench and the ADR review session stay on the backlog unless the lead takes them off (decisions 1 and 6).
- E8.1, E8.3, E8.4 and E8.5 (server, clients, MCP, inspector): compose gains their services when they land.
- A2 (Letta), L1 (lints), E8.9 (simulator) and D1 to D3: `engram lint`, `engram simulate` and the replay validation record keep exiting 2 or being denied with the card named.
