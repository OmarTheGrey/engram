# RV6 H1's live run made fast and reproducible enough to finish before Gate C

Status: done on branch rv6, awaiting review. Paths used: `packages/runner/src/shard.ts` (new), `packages/runner/src/journal.ts`, `packages/runner/src/config.ts`, `packages/runner/src/count.ts`, `packages/runner/src/run.ts`, `packages/runner/src/mem-inv-probe.ts`, `packages/runner/src/longmemeval-probe.ts`, `packages/runner/src/live.ts`, `packages/runner/src/judge.ts`, `packages/runner/src/model/cassette.ts`, `packages/runner/src/model/upstream.ts` (new), `packages/runner/src/research/check-runs.ts` (new), `packages/runner/src/index.ts`, `packages/runner/scripts/run.ts`, `packages/runner/scripts/check-runs.ts` (new), `packages/model/src/cached.ts`, `packages/runner/test/rv6.test.ts`, `rv6-upstream.test.ts` and `rv6-checks.test.ts` (new), `packages/runner/test/live-fakes.ts`, `research/configs/smoke-h1.json`, `smoke-h1-gatemem.json`, `smoke-h1-mem-inv.json`, `b1-gatemem-reference.json` and `check-runs-cost.json` (new), `research/scripts/check_runs_cost.py` and `research/tests/test_check_runs_cost.py` (new), `research/results/check-runs-cost.json` and its MANIFEST row, `docs/tasks/prereg-v1-plan.md` (section 7), `docs/tasks/backlog.md`, Makefile, AGENTS.md and CLAUDE.md.

From the design-gap review of main `00c606e` (findings RV-DES-9, RV-DES-10 and RV-DES-11). Read AGENTS.md, `docs/conventions/testing.md` and `docs/architecture.md` before starting, and card RV1's merged work (#55): the run journal, `RESUME=1`, the outer retry, the spend ceiling and the turn limit.

Goal: H1's live run can be split across processes and machines and merged into the one run `make h1-table` reads, byte for byte the unsharded run; OpenRouter's upstream provider is pinned where pi-ai allows it and recorded on every call; and two pre-tag checks, a smoke run and the B1 reference run, are configured, counted and priced, so the first live call is not the registered H1 run.

The findings this card answers:

- RV-DES-10 (important): the runner is serial. H1 is 80,000 to 188,000 calls plus about 3.9 million Mem0 writes (about 20 hours), so 2 to 11 days of wall time.
- RV-DES-11 (important): OpenRouter's upstream provider is neither pinned nor recorded (`packages/runner/src/live.ts`).
- RV-DES-9 (important): no live call has been made, so the first will be the registered H1 run; Gate B's carried criterion (a), the B1 reference numbers, is open.
- The RV1 backlog row "Concurrent writers": two processes writing one `--out` folder interleave their rows.

Files: `packages/runner/src/` (a shard module, the journal, the three session runners' item lists, the live options, the answer and judge paths), `packages/model/src/cached.ts` (the cassette and ledger fields), `packages/runner/scripts/run.ts`, `packages/runner/test/`, new configs under `research/configs/`, a pricing script under `research/scripts/` with its result and MANIFEST row, section 7 of `docs/tasks/prereg-v1-plan.md`, the backlog, Makefile, AGENTS.md and CLAUDE.md.

Depends on: RV1 (merged, #55), X1, B3, B6.

Acceptance: `make test` passes; `packages/runner/test/rv6.test.ts` (a faux run in one shard against the same run in three shards merged gives byte-identical results.jsonl, events.jsonl, usage.jsonl, summary.json and usage.json and the same cassettes, and a crashed shard resumes and merges; the merge refuses a missing, unfinished, mixed or overlapping shard; a second writer is refused), `rv6-upstream.test.ts` (pi-ai's own OpenRouter provider sends the pinned `provider` object and the serving upstream is recorded in the cassette and the ledger, an old cassette replays unchanged) and `rv6-checks.test.ts` pass; `make run CONFIG=research/configs/smoke-h1.json COUNT=1` and `make run CONFIG=research/configs/b1-gatemem-reference.json COUNT=1` count 50 and 150 sessions offline and both refuse `LIVE=1` under `ENGRAM_OFFLINE=1`; every fixture config replays with zero new calls.

Out of scope: any live or paid call; the B1 tolerance's and the smoke run's acceptance (the lead's, proposed in `decision` entries); setting the spend ceilings of the experiment configs; a check script for the B1 comparison; editing `docs/research/preregistration.md`; a schema change.
