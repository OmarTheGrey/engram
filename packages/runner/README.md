# @engram/runner

The experiment runner: every (item, condition, store, seed) of a config is one fresh pi SDK session with an in-memory session manager, every model call goes through the cache, and the results are deterministic (card RN1, ADR [0001](../../docs/decisions/0001-pi-as-base.md)). `make run` drives it. Back to the [root README](../../README.md).

## Rules

- **Every sampled call takes its seed from the config** (AGENTS.md rule 6), and **every call is cached** on (benchmark item, condition, preset, store, model, seed, prompt hash), so a rerun of the same config makes zero new calls (rule 7, ADR [0017](../../docs/decisions/0017-cached-metered-seeded-model-calls.md)).
- **Replay is the default; a miss is an error.** A live run needs `MODEL=` and `LIVE=1`, records into new cassettes under `.engram/runs/<name>-live`, and is refused under `ENGRAM_OFFLINE=1`.
- **Results are deterministic.** Rows are in config order, ids come from a counter, times from the benchmark, and nothing records a wall-clock time; what the cache did goes to the usage ledger, not the results.
- **A condition differs from its neighbour only in its mechanism.** The one table of mechanisms is `CONDITION_TABLE` in `src/config.ts`; C1 has no memory tool (the long context is in the prompt); C2 to C5 offer the same `memory_read` and `memory_write` tools and the same retrieval, and only C5 runs the real Plane.
- **Pi Durable only behind `ENGRAM_RUNNER=durable`** (card RN2, not built yet).

## Main modules

| module | what it holds |
|---|---|
| `src/config.ts` | the config schema (`RunnerConfig`), `CONDITIONS` (C1 to C5; C6 is not built yet) and `CONDITION_TABLE` |
| `src/conditions.ts` | each condition as a session: no memory tool and the long context in the prompt (C1), the ungoverned tools (C2), the policy text (C3), the metadata read (C4), the plane on core's retrieval pipeline (C5) |
| `src/run.ts` | the serial queue of sessions, the rows, the summary, and the spend-ceiling check before each session |
| `src/journal.ts` | rows and usage appended as each session and call ends, so a crash or a stop keeps them; `RESUME=1` continues; `run.json` fingerprints the config that wrote the folder (its spend ceiling left out), so a resume refuses a folder another config wrote, and raising the ceiling and resuming is how a stopped run goes on |
| `src/shard.ts` | `SHARD=i/n` and `MERGE=n`: contiguous blocks of items, each shard with the ceiling divided by n, joined byte for byte into the unsharded run |
| `src/live.ts`, `src/model/` | the live path on pi-ai (OpenRouter on a seeded API, pinned upstreams, retries of transient failures only) and the cassettes |
| `src/answers.ts`, `src/judge.ts` | where a session's cache misses are answered from (a scripted model, or a live model under `LIVE=1`), and GateMem's answer judge, cached and seeded like any call |
| `src/gatemem-probe.ts`, `src/mem-inv-probe.ts`, `src/longmemeval-probe.ts` | one session per benchmark item |
| `src/lint-faults.ts`, `src/lint-fault-set.ts` | the lint runs: over the fault fixtures (card L3), and both lint tiers over card L2's seeded-fault set (card L4); a lint config with an `nli` block puts card L7's local NLI tier in front of the contradiction model, its scores cached as cassettes |
| `src/bash.ts` | `userBash`: a user `!` command in a runner session, emitted as pi's RPC host does, so C5 blocks store commands there too |
| `src/count.ts` | `COUNT=1`: check a config's data against its pins and count its sessions, with no model call |
| `src/recorder.ts` | the session recorder (card D1): pi session files written through `Plane.write` as episodic items, scrubbed of secrets first, abandoned branches kept as negative evidence |
| `src/induce.ts` | the `distill` benchmark's induction (card D2): recorded sessions in, Agent Workflow Memory's adapted prompt through the cached call, SKILL.md candidates out; the rule-based control on fixtures only (`research/configs/d2-induce-fixture.json`) |
| `src/replay-validate.ts` | the replay validation of card D3: each held-out task run without and with a candidate over seeds 1 to 3, scored by the task's own check; the outcomes go to `Plane.promote`, which derives the admission record (`research/configs/d3-validate-fixture.json`) |
| `src/session-fixtures.ts` | card D1's fifty synthetic fixture sessions from one seed, written into `fixtures/sessions/d1/` by `make fixtures` |
| `src/stores.ts` | the stores a config may name: `fake`, `mem0` (in process, `infer: false`) and `letta`, each fresh and empty per session |
| `src/research/` with `scripts/` | the TypeScript halves of research results: `h1-sessions.ts` (the H1 table's input), `check-runs.ts` (the pre-tag checks), `gatemem-reach.ts`, `mem-inv-admission.ts` and others |

## Use

```sh
make run CONFIG=research/configs/rn1-gatemem-probe.json                       # replay from committed cassettes
make run CONFIG=research/configs/h1-gatemem.json COUNT=1                      # count H1's GateMem sessions, no model called
make run CONFIG=research/configs/h1-gatemem.json MODEL=<provider/model> LIVE=1 SHARD=1/4   # a live shard (needs a key)
make run CONFIG=research/configs/h1-gatemem.json MERGE=4 MODEL=<provider/model> REPLAY=1  # join the four shards
```

The two live lines are for H1 only, after the `prereg-v1` tag and once the config pins its OpenRouter endpoints (pre-tag condition 5 of the pre-registration); before the tag, nothing runs live but the smoke run and B1.

Output goes to `.engram/runs/<config name>`: `results.jsonl` (one row per session), `events.jsonl` (each row's plane log), `summary.json`, `run.json` (what wrote the folder), and the usage ledger (`usage.json`, with `usage.jsonl` appended call by call in a journaled run). A run that reaches its config's `spend_ceiling_usd` stops and exits 3. AGENTS.md's command list gives every flag.

## Test

```sh
pnpm --filter runner exec vitest run
make test-scale      # H1's GateMem results at full size, written and read back a line at a time; slow
```

Every test runs on scripted models or committed cassettes; pi-ai's faux provider stands in for a live one, and no test reaches a provider. `test/run.test.ts` is card RN1's acceptance (a rerun makes zero new calls).

## What is next

- **Before the `prereg-v1` tag** (pre-tag conditions 3 and 7 of the pre-registration): record an answer call the provider refused for good as an exclusion with its own reason (an HTTP 401, 402 or 403 stops the run instead), and check the programme-wide spend cap in billed dollars before each session.
- **Then:** H1's live runs from 1 December, during which nothing merges that changes code a registered config runs; condition C6 for H3; the files store in the runner for ADR 0035's request-identity check; drift retirement of admitted procedures (card D4); and Pi Durable behind its flag (card RN2).
