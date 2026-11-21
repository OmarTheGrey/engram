# @engram/bench

The benchmark harnesses: each pinned benchmark ported or wrapped so that its memory calls cross the plane and its model calls go through the cached, seeded call. Pins, licences and plug-in points are in [`PINS.md`](PINS.md). Back to the [root README](../../README.md).

## Rules

- **A pin never moves mid-experiment** (AGENTS.md rule 8). Moving one is its own PR, with the change in results explained.
- **No benchmark enters a result unless the pre-registration names it** ([`docs/research/preregistration.md`](../../docs/research/preregistration.md)). A new one is proposed there first; checked candidates wait in `PINS.md`'s second table.
- **Every model call is seeded and cached** (rules 6 and 7) through `@engram/model`. A Python harness (MERIT, tau2-bench) reaches its model only through the cassette proxy, and a config whose harness endpoint is not the proxy is refused.
- **Open labels are stripped.** GateMem's answer keys sit in the files an agent reads, so the harness strips them before anything reaches the plane; MEM-INV-Bench's and LongMemEval's are stripped the same way.
- **Fixture subsets are offline.** `make bench` uses the scripted model and committed cassettes; a cassette miss is an error and is never recorded into them.

## Main modules

| module | benchmark | what it holds |
|---|---|---|
| `src/gatemem/` | GateMem, 2,218 checkpoints (card B1, B3) | the loader at the pin, the long-context and RAG-policy reference agents, principals mapped to scopes and grants (ADR [0030](../../docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md)), the rule scorer and the ported GPT-4o judge |
| `src/mem-inv-bench/` | MEM-INV-Bench, 38 cases (card B4) | the laundering-channel cases, their prompt, the plane mapping and the ported rule bucketer, held to upstream by `fixtures/bench/mem-inv-bench/upstream-golden.json` |
| `src/longmemeval/` | LongMemEval, cleaned S split (card B5) | the loader, the prompt, the plane mapping (each turn an item, read at the question's date) and the ported judge |
| `src/merit/` | MERIT (card B7) | the pinned harness as an external Python 3.11 process in its own environment under `.engram/`, its `MemoryBase` seam over loopback HTTP to the plane, the proxy launch and the cost summary |
| `src/tau2/` | tau2-bench v1.0.1 (card B11) | the pinned harness in its own Python 3.12 environment, a memory-carrying agent registered with tau2's own registry under C2 and C5, the agent, user-simulator and judge calls through cassette proxies, tau2's own reward |
| `src/faults/` | the seeded-fault set (card L2) | LongMemEval memory states with labelled faults (stale, contradictory, misplaced, unsupported) and near-misses, for H3's lint precision and recall |

Scripts in `scripts/`: `run-gatemem.ts`, `run-merit.ts` and `run-tau2.ts` (what `make bench` runs), `dry-run-gatemem.ts` (`DRY=1`), `vendor-*.ts` and `vendor-mem-inv-bench.py` (the fixture subsets, run by `make fixtures`), `fault-set.ts`, the `upstream-*.py` goldens, and the Python shims `merit-shim.py`, `tau2_engram.py` and `tau2_memory.py`.

## Use

```sh
make bench BENCH=gatemem        # the pinned fixture checkpoints, scripted model, cassettes; output in .engram/bench/gatemem
make bench BENCH=longmemeval    # replays research/configs/b5-longmemeval-plane.json
make bench BENCH=merit          # fetches MERIT at its pin and installs its environment once, then replays offline
make bench BENCH=tau2           # the same for tau2-bench
make bench BENCH=gatemem DRY=1  # count the live GateMem run's calls and prompt size on the full set; no model called
```

The registered experiments run through `packages/runner` (`make run CONFIG=...`), which builds on these harnesses.

## Test

```sh
pnpm --filter bench exec vitest run
```

Layer 7 of `docs/conventions/testing.md`: each harness on its fixture subset with a scripted model, asserting the pipeline and not the score. `test/gatemem/` also checks the ported judge and scorer against upstream's goldens, `test/*/pinned.test.ts` the vendored files against their pin, and `test/*/licence.test.ts` the licences.

## What is next

- Card X14: a red-team harness in `src/redteam/`, with OWASP's AMSB scenarios, pinned public payload sets and benign controls, run offline by `make redteam`; a live run waits for its arm to be registered (proposal P1 of the pre-registration).
- Card B9 (MemoryAgentBench) is to be rescoped, since no hypothesis runs on it after 2026-11-20; HaluMem (card B8) stays unregistered for its licence.
- MERIT's run size for H2 is counted by card B7's config before its first live run; tau2-bench's task split for H5 is still to be fixed.
