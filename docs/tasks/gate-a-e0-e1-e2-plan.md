# Plan: finish Gate A and the remaining E0, E1 and E2 cards

Status: proposed by the orchestrating session on 2026-10-29 and revised the same day with its decisions taken on the lead's instruction (`docs/log/2026-10-29-plan-decisions-taken.md`); every decision stays pending the lead's review, with the ADRs it drafted. Six PRs at most, this one included (its two parts are one PR in this count, as step 0 was). Each PR follows AGENTS.md and the two conventions; rule 10 (one card per PR) is set aside for them as it was for PRs #2 to #7 (`docs/log/2026-10-25-six-prs-for-the-next-cards.md`).

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

## 2. Decisions taken

Each was open on 2026-10-29; the lead asked the orchestrating session to decide them from the literature review (`docs/readings/litreview/README.md`, design section) and the pending ADR amendments. The lead accepts, amends or reverses each in the ADR review session (`docs/tasks/backlog.md`).

1. **Gate A is declared passed with two recorded exceptions.** The roadmap's fail response (extend phase 0 by a week) buys nothing while the pre-registration is backlogged: the GateMem live run cannot happen in that week, and MPBench's release is not in the team's hands. Both pieces were deferred by the backlog decision of 2026-10-22. The exceptions, carried into Gate B's checklist: (a) GateMem reference numbers within tolerance run when the pre-registration leaves the backlog, on the judge PR 6 ports; (b) the poisoning arm runs on MEM-INV-Bench or BF1 if MPBench is not released by Gate B (decision 6). PR 6 writes the `milestone` entry with the four criteria and this register.
2. **E1.1 Postgres runs on a worker thread behind the synchronous `Db` contract** (ADR 0024). Core does not change; the contract becomes a test suite both backends pass; the outer Postgres transaction takes an advisory lock, which serialises writers across processes, something the SQLite log cannot do; CI runs both backends. Driver: `postgres` (postgres.js, public domain), exact-pinned. Deferral and an asynchronous `Db` are recorded as the alternatives not taken.
3. **A confirmation is independent corroboration** (ADR 0026): an allowed write in the same scope of the same normalised content, by a different actor, with provenance kind `user`, `document` or `tool`. Writes by the same actor, or with kind `model` or `compaction`, never count: Origin-Bound Authority (2606.24322) proves planted corroboration launders authority, and elevation is sound only through independent trusted principals. Confirmations are counted from the log, never stored.
4. **A reviewer is a user-sourced member of the target scope who is not the item's owner** (ADR 0026). An approval is an authorisation; Authorization Laundering (2609.01836) shows self-recorded authority is acted on 98.6 percent of the time, so a `model`-sourced actor cannot approve and the owner cannot approve their own item. The promote event's actor is the approver.
5. **Retention runs as `Plane.retain(actor, scope, at)`, called by the surfaces, as a scope member** (ADR 0025): the pi extension after an allowed write to that scope and at `before_agent_start` for the session's scopes, `engram read` before adoption. The budget check also runs in the write path's queue slot after a landing write, so no write sequence leaves a scope over budget. Nothing runs on a timer: the plane has no clock. Expired items are excluded at read before any sweep, because lifecycle is an admissibility axis (2610.07309).
6. **MPBench: the request is sent now and MEM-INV-Bench is pinned as the fallback.** The lead sends `docs/research/mpbench-request.md` and the date goes into `packages/bench/PINS.md` (PR 6). PR 6 also checks MEM-INV-Bench (2606.24322, the fallback the literature review names) for a code and data release the way S0.6 did and adds its row; BF1 (reconstruction) is the fallback's fallback. The arm's choice is dated at Gate B at the latest.

## 3. What the research adds, within scope

Each item cites the note that forces it and names the PR that carries it. Items that need a schema change are listed under "not now" instead.

| enhancement | why | where |
|---|---|---|
| A read excludes items past their ttl as a lifecycle exclusion (`engram/read/ttl`, counted in `filtered`) before any sweep retires them | admissibility has a lifecycle axis; a stale sweep must not leak (2610.07309) | PR 4, ADR 0025 |
| A `model`, `compaction` or `tool` write whose content hash equals a retired item's in that scope is denied (`engram/write/retired-content`); a user, document or import write may re-admit it | Bemula's relearning suite: a similar later fact re-establishes what was removed; retire-not-delete keeps the evidence to stop it (2610.18052) | PR 4, ADR 0025 |
| `manual` eviction appends one `evict` event with decision `ask` naming the overage | every policy decision is an event (AGENTS.md rule 3); the overage reaches the session and the review queue | PR 4, ADR 0025 |
| Confirmations by distinct actor and trusted provenance kind; reviewers user-sourced and not the owner | laundering channels L-a to L-c (2606.24322); self-granted authority (2609.01836) | PR 5, ADR 0026 |
| A promoted semantic item's lineage names every confirming item, and its provenance kind is the least trusted among its sources | reflections cite their evidence (2304.03442); derived items inherit the maximum untrust (2606.24322) | PR 5, ADR 0026 |
| A promotion is evaluated as a write into the target scope, so invariant 2 covers it | a promotion must never land where a write could not (ADR 0007) | PR 5 |
| The preset comment states the one-sided Wilson upper bound on failure that `replay_k` of `replay_n` implies | SKILL.nb's Wilson bound gives k of n a statistical form; the current 4 of 5 bounds failure only at about 0.52 at alpha 0.05, which the lead should see before any D3 run (2606.08049) | PR 5 |
| C2, C3 and C5 render a read in the same memory-tag shape; only C5's carries the read id and admitting rules | conditions differ only in mechanism (decision D13); admission moves the needle and presentation does not, so the shared shape costs the claim nothing and removes a confound (2610.11188); settles the question ADR 0015's amendment left open | PR 6, ADR 0015 amendment |
| `engram doctor` also checks the pi pin against `docs/deps.md` and that Node is 24 or later (node:sqlite) | a wrong pi version changes the interception points S0.5 proved; node:sqlite is the log | PR 3 |
| Calling context as a policy input: justified absent for v1 in ADR 0006; the harness enters through `actor.source` and `memberships`, a per-tool context is v2 with a policy language | the literature review asks ADR 0006 to add it or justify its absence (2507.03724) | PR 5, ADR 0006 amendment |
| The invariants' generators keep producing direct-id lookups only through `Plane.read`; a test asserts the Plane exposes no item-returning method other than `read` and `promote`'s own result | MemClaw's get-by-id bypass was invariant 1 on the wrong path (2606.24535) | PR 5, invariants file |

Not now, recorded for the ADR review session and the next schema PR: a `derived_from` list on provenance (the trust ceiling, 2606.24322); a reliability score on procedural items (MSCE, D4); a policy field for the procedural lifecycle triggers (`replay-drift`, `environment-changed`); an explanation field carrying the superseding version id when a query matches a superseded version (STALE's premise resistance, 2605.06527); a `volatility` class on items for the expired-validity lint (ADR 0005 amendment); a reinstatement surface (ADR 0010 says retired items come back by event; ADR 0025 defines the event, no command yet); record the returned item ids on read events, so utility evictions can be re-decided from the log, a rebuilt database, a session or the simulator (ADR 0025's amendment for finding P4-5).

## 4. The six PRs

Order: PR 1 now (two parts, both merged). PR 2, PR 4 and PR 5 in parallel on main (PR 5 stacks on PR 4, since both edit `plane.ts`, `plane/write.ts` and the invariants file). PR 3 on PR 2. PR 6 last, on PR 3. Each PR: acceptance test first, implementation, mutation checks on the critical rules, log entries per card and per failure, ADR amendments in the amendment lists with status lines unchanged, and an independent review before merge as for PRs #2 to #7.

### PR 1. Phase 0 close-out (merged: #8, and part 2)

Cards: none (bookkeeping). Part 1 updated the status line of every card PRs #2 to #7 delivered, recorded the merge as a milestone and committed this plan. Part 2 took the six decisions, added ADRs 0024 to 0026 and revised the plan. Acceptance: `make lint-docs && pnpm exec vitest run scripts/test/tasks-and-decisions.test.ts`.

### PR 2. E1.1: the Postgres backend behind the `Db` contract (ADR 0024)

1. `packages/core/test/db/contract.ts`: the `Db` contract as a suite any backend must pass: exec, prepare with every `Param` type, `run` changes, `get` and `all` row shapes, nested transactions as savepoints, rollback on throw, the synchronous-body rule, and the whole of `events.test.ts`, `items.test.ts` and the replay tests run through a factory. SQLite passes it first (red on a deliberately broken fake backend, then green).
2. `packages/core/src/db/postgres.ts`: `openPostgres(url)` on a worker thread (`node:worker_threads`, `SharedArrayBuffer`, `Atomics.wait` with a timeout that throws `DbTimeoutError`); one connection per `Db`; `BEGIN` plus `pg_advisory_xact_lock` on the outer transaction, `SAVEPOINT`, `RELEASE`, `ROLLBACK TO` as statements; `?` rewritten to `$n`; `bigint` and `Uint8Array` mapped; the migrations stay one list, with SQLite-only text behind the backend's `dialect`.
3. CI and local runs: an embedded Postgres 17 from `embedded-postgres`, started by the core tests' vitest globalSetup, replaces the `postgres:17` service container on the lead's no-Docker instruction (ADR 0024 amendments); `ENGRAM_PG_URL` names a server instead, and the Postgres runs skip cleanly with the reason printed when the server cannot start, except under CI.
4. ADR 0003 amendment pointing at ADR 0024; `docs/deps.md` row for `postgres`, exact-pinned.

Acceptance: `pnpm --filter core exec vitest run test/db` on both backends; `make test` green; `make test-invariants` 4 passed. Mutation checks: the advisory lock removed (two processes interleave), the placeholder rewrite broken, the timeout removed (a stalled worker blocks). Out of scope: any surface reading the URL (PR 3).

### PR 3. E0.4: the SQLite dev path and Postgres targets, a complete `engram doctor`, `make test-e2e` (compose for deployment only)

1. `docker-compose.yml` for deployment only, and it says so: a `postgres` service (volume, healthcheck) now; the `server` and `ui` services are added by E8.1 and E8.5. No test, gate, Makefile target or CI job uses it (the lead's no-Docker instruction of 2026-10-29). `.env.example` with `ENGRAM_DB_URL` and the provider key names the doctor checks. ADR 0019 amendment: the dev environment is Node, pnpm and uv with the per-user SQLite log; compose is deployment only; what it holds at each card.
2. The CLI accepts `ENGRAM_DB_URL` (or `--db postgres://...`) and opens the matching backend through one `openDb(target)` in `packages/cli/src/setup.ts`; the default stays `<home>/.engram/engram.db` (decision D9). The extension takes an injected `Db` and nothing opens a log for it yet, so `ENGRAM_DB_URL` reaches it when a loader does.
3. `engram doctor` checks, each with a line and a reason: the log (opens, migrations current, backend named); the policy (loads, preset or path); the store root; adapters (files opens the root; Mem0 opens an in-memory instance offline with the hashing embedder; letta still skipped, card A2); provider keys (for each provider pi-ai names, whether its key variable is set, through the runner's model layer since the CLI may not import pi-ai, never reading the key's value, no network); benchmark pins (`packages/bench/PINS.md` parses, every vendored fixture's hash matches `fixtures/bench/gatemem/manifest.json`); the pi pin equals `docs/deps.md`; Node 24 or later. `doctor` still never creates a log.
4. `make test-e2e` (layer 6): an embedded Postgres from `embedded-postgres`, started by core's test globalSetup (no Docker), `engram doctor` on SQLite and on Postgres, a CLI smoke (write, read, explain on a temp folder) on both; the MCP handshake step is added by E8.4. Runs on main and nightly, not on every PR.
5. AGENTS.md: the `engram doctor` and `make test-e2e` lines; CLAUDE.md identical.

Acceptance: `make test-e2e` green locally; `pnpm --filter cli test` with a doctor test per check, each shown red by removing the thing it checks. Out of scope: the server and the UI.

### PR 4. E2.4: retention (ADR 0025)

1. `packages/core/src/policy/retention.ts`: `evaluateRetention(policy, scope, items, at, usage)`, pure, returning the retirements a sweep would make with reason and policy id `<policy>/retention/<level>/<class>`: expiry (`valid_from` plus `ttl` not after `at`, full-precision compare) as op `retire`; budget overage as op `evict` in the rule's order (`recency`: oldest by last changing event; `utility`: fewest explanation rows naming the item, ties by recency; `manual`: nothing evicted, one `evict` event with decision `ask` naming the overage).
2. The read path excludes expired items as a lifecycle exclusion (`engram/read/ttl`, counted in `filtered`); invariant 1's oracle does the same.
3. The write gate denies `engram/write/retired-content` for a `model`, `compaction` or `tool` source whose normalised content hash equals a retired item's in the scope; `user`, `document` and `import` may re-admit. The content hash helper is the one ADR 0018 names, shared with PR 5 and later with L1.
4. `Plane.retain(actor, scope, at) -> RetentionReport` in `packages/core/src/plane/retention.ts`: membership required (`engram/retention/membership`); every retirement one event mirrored to the pi session; items stay in the store; runs inside the write queue. The write path runs the budget check for the written scope and class after a landing write, in the same queue slot.
5. Surfaces: the extension calls `retain` after an allowed write and at `before_agent_start` for the session's scopes; `engram read` calls it before adoption. A `fixtures/sessions/` session where a write evicts, regenerated by `make fixtures`.
6. The lead-owned invariants: a fifth property ("after any write sequence, no scope holds more active items of a class than its budget; every retire or evict event carries a reason and a policy id; replay reproduces it") and the oracle changes of items 2 and 3; second reviewer and a `decision` entry.
7. ADR 0010 amendment pointing at ADR 0025; preset comments say the ttl and budget numbers are proposed values.

Acceptance: `pnpm exec vitest run packages/core/test/unit/policy/retention.test.ts packages/core/test/unit/plane/retention.test.ts`: budget exceeded evicts per policy under all three orders, expiry retires and is excluded at read before the sweep, retired content is refused to a model source and admitted to a user source, events recorded and replayable; `make test-invariants` 5 passed. Mutation checks: each order, the membership check, the budget boundary, the read-time exclusion, the retired-content source list.

### PR 5. E2.5: promotion (ADR 0026)

Stacks on PR 4.

1. `packages/core/src/policy/promotion.ts`: `evaluatePromotion(policy, actor, item, target, evidence)`, pure, with `evidence = { confirmations, review, validation? }`; policy ids as ADR 0026 lists them. Episodic to semantic at k confirmations, or by a reviewer when `or_review`; procedural candidate to active only with a validation record meeting `replay_k` of `replay_n`; a scope widening or class change evaluated as a write into the target scope (membership, sources, classes, floor, review).
2. `Plane.promote(actor, itemId, toScope, at)` in `packages/core/src/plane/promote.ts`: counts confirmations from the log (distinct actor, trusted kind, same normalised content hash, same scope); decides; on allow appends the `promote` event carrying the item as it now stands. Status-only transitions in place (same id, version plus one). Class or scope changes: a new id whose lineage names the source and every confirming item, provenance kind the least trusted among the sources, the store written through the adapter, and the source retired by a `retire` event (`<policy>/promotion/superseded`) in the same queue slot. `ask` with a null item and one `gate` event when `requires_review` holds and the actor is not a reviewer.
3. `engram promote <item-id> --to <scope> [--review]` in the CLI (one Plane call; exit 0, 1 on deny or ask, 2 on usage); no new pi tool (the architecture lists four), `/engram promote` waits for PX2.
4. The invariants: invariant 2's oracle gains promotions, the generators produce confirmation sequences (same and different actors, trusted and untrusted kinds) and reviews; a test that the Plane exposes no item-returning method other than `read` and `promote`'s own result; second reviewer and a `decision` entry.
5. ADR 0011 amendment pointing at ADR 0026; ADR 0006 amendment justifying the absence of calling context in v1; preset comments say `confirmations`, `replay_k` and `replay_n` are proposed values and state the Wilson bound the procedural pair implies.

Acceptance: `pnpm exec vitest run packages/core/test/unit/policy/promotion.test.ts packages/core/test/unit/plane/promote.test.ts packages/cli/test/promote.test.ts`: a fixture promotes only after k confirmations by different actors (the same actor writing k times does not promote; model-sourced writes do not count), the review path records the approver and refuses the owner and a model-sourced actor, a procedural candidate without a validation record stays candidate, a widening the target's rule forbids is denied; `make test-invariants` 5 passed. Mutation checks: the k boundary, the distinct-actor rule, the trusted-kind rule, the owner-as-reviewer rule, the widening-as-write rule.

### PR 6. Gate A: the GateMem judge, the conditions' tag shape, the dogfood record, the gate decision

1. B1: vendor `bench/prompts/judge_prompt.txt` from the pin (MIT, with `UPSTREAM-LICENSE`); `packages/bench/src/gatemem/judge.ts` builds the judge call as a `ModelCall` with the paper's settings (`gpt-4o`, temperature 0) and parses its verdict the way `score_predictions.py` does; `make bench BENCH=gatemem` reports the rule-based scores as now and, when judge cassettes exist, the judge scores; in tests the judge is scripted and a golden file holds its verdicts on the 20 checkpoints. The live run (reference numbers within tolerance) stays a dated item in the card, blocked by the pre-registration; the tolerance is set there.
2. `make bench BENCH=gatemem DRY=1`: the reference agent over the full checkpoint set in dry-run mode lists how many model calls the live run would make and at which cache keys, so the cost is known before the pre-registration leaves the backlog.
3. RN1: C2 and C3 render a read in the same memory-tag shape as C5, without the read id and admitting rules; a test asserts the rendered reads of the three conditions differ only in those attributes; cassettes re-recorded once through `make fixtures`; ADR 0015 amendment closing its open question (the tag is presentation, shared; the mechanism is admission).
4. Dogfood: `docs/dogfood.md` with one row per member (date, memories adopted, filtered, denied; counts only, AGENTS.md rule 12) from `engram read --root <their folder> --owner <id>`; a human step for each member.
5. Benchmarks: MEM-INV-Bench checked for a release the way S0.6 did (`gh api`, the paper), a row in `packages/bench/PINS.md` and a `finding` entry; the MPBench request's sent date in PINS.md (the lead sends it).
6. The Gate A record: a `milestone` log entry with the four criteria, their evidence and the exception register of decision 1; `docs/tasks/B1.md`, `B2.md`, `BF1-mpbench-fallback.md` and `backlog.md` updated.

Acceptance: `pnpm --filter bench test` (judge parsing against the golden verdicts; dry-run counts) and `pnpm --filter runner test` (the tag-shape test); `ENGRAM_OFFLINE=1 make bench BENCH=gatemem` and `ENGRAM_OFFLINE=1 make run CONFIG=research/configs/rn1-gatemem-probe.json` green. Out of scope: any paid model call; the pre-registration.

## 5. What this plan does not do

- Pre-registration v1 and the ADR review session stay on the backlog; MPBench leaves it only by decision 6.
- E8.1, E8.3, E8.4 and E8.5 (server, clients, MCP, inspector): compose gains their services when they land.
- A2 (Letta), L1 (lints), E8.9 (simulator) and D1 to D3: `engram lint`, `engram simulate` and the replay validation record keep exiting 2 or being denied with the card named.
- Schema changes: none in these PRs; the "not now" list in section 3 goes to the next schema PR.
