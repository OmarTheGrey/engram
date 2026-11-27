# @engram/bench

The benchmark harnesses: each pinned benchmark ported or wrapped so that its memory calls cross the plane and its model calls go through the cached, seeded call. Pins, licences and plug-in points are in [`PINS.md`](PINS.md). Back to the [root README](../../README.md).

## Rules

- **A pin never moves mid-experiment** (AGENTS.md rule 8). Moving one is its own PR, with the change in results explained.
- **No benchmark enters a result unless the pre-registration names it** ([`docs/research/preregistration.md`](../../docs/research/preregistration.md)). A new one is proposed there first; checked candidates wait in `PINS.md`'s second table.
- **Every model call is seeded and cached** (rules 6 and 7) through `@engram/model`. A Python harness (MERIT, tau2-bench) reaches its model only through the cassette proxy, and a research config whose harness endpoint is not the proxy is refused. That is a configuration check, not a network control (ADR [0036](../../docs/decisions/0036-cassettes-beyond-the-repository.md)): nothing stops a harness from reaching the network by another path.
- **Open labels are stripped.** GateMem's answer keys sit in the files an agent reads, so the harness strips them before anything reaches the plane; MEM-INV-Bench's and LongMemEval's are stripped the same way.
- **Fixture subsets are offline.** `make bench` uses the scripted model and committed cassettes; a cassette miss is an error and is never recorded into them. MERIT and tau2-bench fetch their pinned harness and install its Python environment under `.engram/` once, the only network they use; every run after that is offline.

## Main modules

| module | benchmark | what it holds |
|---|---|---|
| `src/gatemem/` | GateMem, 2,218 checkpoints (card B1, B3) | the loader at the pin, the long-context and RAG-policy reference agents, principals mapped to scopes and grants (ADR [0030](../../docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md)), the rule scorer and the ported GPT-4o judge |
| `src/mem-inv-bench/` | MEM-INV-Bench, 38 cases (card B4) | the laundering-channel cases, their prompt, the plane mapping and the ported rule bucketer, held to upstream by `fixtures/bench/mem-inv-bench/upstream-golden.json` |
| `src/longmemeval/` | LongMemEval, cleaned S split (card B5) | the loader, the prompt, the plane mapping (each turn an episodic item; the read is made at the question's date, or at the last turn's time when a history session is dated after the question) and the ported judge |
| `src/merit/` | MERIT (card B7) | the pinned harness as an external Python 3.11 process in its own environment under `.engram/`, its `MemoryBase` seam over loopback HTTP to the plane, the proxy launch and the cost summary |
| `src/tau2/` | tau2-bench v1.0.1 (card B11) | the pinned harness in its own Python 3.12 environment, a memory-carrying agent registered with tau2's own registry under C2 and C5, the agent, user-simulator and judge calls through cassette proxies, tau2's own reward |
| `src/faults/` | the seeded-fault set (card L2) | LongMemEval memory states with labelled faults (stale, contradictory, misplaced, unsupported) and near-misses, for H3's lint precision and recall |
| `src/redteam/`, `src/amsb/` | the red-team harness (card X14) | a seeded, model-free attack suite against `Plane.write` and `Plane.read`: OWASP's AMSB scenarios (`fixtures/amsb`), the deepset and Lakera payload sets fetched at their pins, and benign controls, planted through the write route and adopted at read as each source kind; scored by `research/scripts/redteam.py` into `research/results/h1-redteam.json`, an engineering check of proposal P1 that enters no registered analysis |

Scripts in `scripts/`:

- `run-gatemem.ts`, `run-merit.ts` and `run-tau2.ts`: what `make bench` runs; `dry-run-gatemem.ts`: `DRY=1`.
- `vendor-longmemeval.ts` and `vendor-mem-inv-bench.py`: the fixture subsets, run by `make fixtures`; `vendor-gatemem.ts`: GateMem's subset, run by hand from a local copy of the upstream files at the pin.
- `fault-set.ts`: the seeded-fault set (card L2), run by `make fixtures`; `fault-set-check.ts`: checks a fault set's labels against the lints.
- `upstream-*.py`: the goldens from upstream's own code (`upstream-full-scores.py` with `check-gatemem-upstream.ts`, and `check-rag-policy-upstream.ts`, are one-off port checks on the full GateMem set); `longmemeval-date-facts.ts`: two facts about LongMemEval's dates that bear on its read time.
- `merit-shim.py`, `tau2_engram.py` and `tau2_memory.py`: the Python side of the MERIT and tau2 seams.

## Use

```sh
make bench BENCH=gatemem        # the pinned fixture checkpoints, scripted model, cassettes; output in .engram/bench/gatemem
make bench BENCH=longmemeval    # replays research/configs/b5-longmemeval-plane.json
make bench BENCH=merit          # fetches MERIT at its pin and installs its environment once, then replays offline
make bench BENCH=tau2           # the same for tau2-bench
make bench BENCH=gatemem DRY=1  # count the live GateMem run's calls and prompt size on the full set; no model called
make redteam                    # card X14: fetches the pinned payload sets once (data only), then runs offline with no model
```

GateMem, MEM-INV-Bench and LongMemEval experiments run through `packages/runner` (`make run CONFIG=...`), which builds on these harnesses. MERIT and tau2-bench run through this package's own launchers (`src/merit/`, `src/tau2/`); their live runs are left to cards X7 (MERIT, for H2) and X11 (tau2-bench, for H5).

## Test

```sh
pnpm --filter bench exec vitest run
```

Layer 7 of `docs/conventions/testing.md`: each harness on its fixture subset with a scripted model, asserting the pipeline and not the score. `test/gatemem/` also checks the ported judge and scorer against upstream's goldens, `test/*/pinned.test.ts` the vendored files against their pin, and `test/*/licence.test.ts` the licences.

## What is next

- A live red-team run waits for its arm to be registered (proposal P1 of the pre-registration).
- Card B9 (MemoryAgentBench) is to be rescoped, since no hypothesis runs on it after 2026-11-20; HaluMem (card B8) stays unregistered for its licence.
- MERIT's sessions for H2 are counted before its first live run, which card X7 makes, and H5's prerequisites for tau2-bench (the task split, the user-simulator model) are drafted for the lead before H1's data exist (the pre-registration, H5), then run by card X11.
- From the second absorb plan ([`docs/tasks/absorb-plan-2.md`](../../docs/tasks/absorb-plan-2.md)), none merged yet: the paired fault-injection check for H3 (card X18, proposal U6) and the erasure-residue check (card X19, proposal U7).
