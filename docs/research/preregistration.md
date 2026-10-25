# Pre-registration

**Backlogged by the lead on 2026-10-22** (`docs/tasks/backlog.md`): v0.1 stands as written, and no work on v1 happens until the item leaves the backlog.

Version v0.2, dated 2026-10-25 (a wording fix to v0.1, see Versions); v0 is tagged `prereg-v0`. Every version is dated and kept. The version that precedes the first real run is tagged `prereg-vN` and deposited externally (OSF or Zenodo, ADR 0023); changes after that are amendments with reasons, never edits. `research/tests/test_prereg.py` checks that this file is complete.

**Status of v0.** Drafted during step 0 from the roadmap (`docs/roadmap.md`: Gate C, cards X1 to X13), the proposed ADRs (0006, 0015, 0016, 0017, 0022) and the literature review (`docs/readings/litreview/`). The proposal that holds the original hypothesis wording was not in the repository, so the statements below are reconstructions. Values marked "proposed" are design choices made in this draft. The lead confirms or amends every hypothesis, threshold and model before `prereg-v1`, and nothing runs before that.

## Question

What does enforcing memory governance at the boundary cost, compared with asking the model to behave, across stores and models?

## Conditions

Each condition fixes how memory reaches the agent. The store, model, preset and seed vary within a condition, never the condition's mechanism.

| id | name | memory path | governance |
|---|---|---|---|
| C1 | no memory | none; long context only | none |
| C2 | ungoverned | the store directly | none |
| C3 | instruction | the store directly | the policy as text in the system prompt |
| C4 | instruction with metadata | the store directly, retrieval carries requester and policy metadata (GateMem's RAG-Policy) | the model decides from the metadata |
| C5 | enforced | the Engram plane: write gate and read filter only, preset medium unless the hypothesis sweeps presets; no lints run, whatever the preset's `lints.enabled` lists | deterministic, before the model call |
| C6 | enforced with lints | as C5, plus the lints the preset's `lints.enabled` lists: deterministic lints, and model-based lints where stated | deterministic gate; lints retire flagged items |
| C7 | governed tools without read filtering | the Engram tools over MCP: write gate, no `context` filter | the harness-agnostic path of ADR 0022 |

## Benchmarks

Pinned in `packages/bench/PINS.md`; no benchmark outside this table enters a result without an amendment.

| benchmark | used for | items in the primary analysis |
|---|---|---|
| GateMem | H1, H2, H4 | the 727 access-control and 763 active-forgetting checkpoints for violations; the 728 utility checkpoints for utility |
| MPBench | H1 | the released attack and benign cases, or the reconstruction of card BF1 if no release arrives (stated in an amendment) |
| LongMemEval | H2, H3 | the 500 questions of the cleaned S split |
| MERIT | H2 | the seeded arcs of domains D1 to D3 at the pinned commit |
| MemoryAgentBench | H4 | the Conflict Resolution split, plus the Accurate Retrieval split for utility |
| tau2-bench | H5 | airline and retail test splits at tag v1.0.1 |

Before any run, 50 items per benchmark are label-audited by two members and the disagreement rate is reported (ADR 0015).

## Models

Three hosted models from three providers, reached through pi-ai (ADR 0016). Provider choice is pending; the placeholders are fixed before `prereg-v1`.

| id | role | provider | model |
|---|---|---|---|
| M1 | primary: every hypothesis, every sweep | to be fixed | to be fixed |
| M2 | second: fixed subset for H2 and H4 | to be fixed | to be fixed |
| M3 | third: fixed subset for H2 and H4 | to be fixed | to be fixed |

Fixed subsets (roadmap, compute budget): about 100 GateMem probes, 100 MPBench attacks, 200 LongMemEval questions and 50 MERIT tasks per model, at the conditions each hypothesis names.

## Seeds

- **Seeds:** 1, 2, 3

Every model call takes its seed from the experiment config and is cached on (benchmark item, condition, preset, store, model, seed, prompt hash) (ADR 0017). pi-ai exposes no sampling seed, so a seed is one recorded sample: replays are exact, fresh samples are not (log entry 2026-10-22-s0-10-pi-ai-no-seed).

## Statistics

- Unit of analysis: the benchmark item, paired across conditions on the same item, model and seed.
- Interval: paired bootstrap of the mean difference, 10,000 resamples, BCa, 95 percent (Efron and Tibshirani 1993).
- Multiplicity: each hypothesis has one primary test, whose one-sided bootstrap p-value is the share of resamples at or below zero. Holm adjusts the five p-values at family-wise alpha 0.05 (Holm 1979); a hypothesis is supported when its Holm-adjusted p-value is below 0.05. Intervals are reported unadjusted at 95 percent beside the adjusted decision.
- Seeds: results are averaged over the three seeds within an item before resampling; the seed spread is reported.
- The analysis code is tested on synthetic data with a planted effect and a planted null before it sees real data (`research/tests/test_analysis.py`).

## Hypotheses

### H1. Enforcement beats instruction

- **Statement:** On the primary model, the enforced condition (C5) produces a lower governance-violation rate than the instruction conditions (C3 and C4), and both are compared with ungoverned memory (C2).
- **Conditions:** C2, C3, C4, C5
- **Benchmarks:** GateMem, MPBench
- **Metric:** violation rate: on GateMem the share of access and forgetting checkpoints that leak a target or take the wrong action (A and F, Sec. 3.2 of the paper); on MPBench the attack success rate. GateMem MGS is reported as secondary.
- **Test:** one-sided paired bootstrap of the difference C4 minus C5 (the stronger instruction condition), per benchmark; the primary test is GateMem on M1, decided by its Holm-adjusted p-value.
- **Stopping rule:** fixed sample: every access and forgetting checkpoint, three seeds, run once to completion; no interim analysis except the single Gate C read-out of the full sample.
- **Analysis:** supported if the Holm-adjusted p-value for C4 minus C5 on GateMem is below 0.05 and the MPBench interval does not contradict it; otherwise the Gate C pivot applies (characterise where boundary enforcement fails). Per-attack-family breakdowns are exploratory.
- **Results:** research/results/h1-*

### H2. The governance tax has a knee

- **Statement:** Enforcement costs utility and tokens, and across policy strictness the cost-utility frontier has a knee: a preset that keeps most of the ungoverned utility while removing most violations (proposed: at least 90 percent of C2 utility with at most 20 percent of C2 violations).
- **Conditions:** C1, C2, C5
- **Benchmarks:** GateMem, LongMemEval, MERIT
- **Metric:** utility (GateMem U, LongMemEval accuracy, MERIT task success) and cost (tokens and dollars per item, from the cost ledger), at three presets (strict, medium, permissive).
- **Test:** paired bootstrap of the utility difference C2 minus C5 at each preset; the primary test is the medium preset on LongMemEval on M1; knee detection on the frontier is descriptive.
- **Stopping rule:** fixed sample per preset; the sweep stops at the per-provider spend ceiling set in the experiment config, and a stopped sweep is reported as the completed subset.
- **Analysis:** supported if the medium preset's utility interval for C2 minus C5 stays below the proposed 10 percent of C2 utility while its violation rate stays under the proposed 20 percent of C2's; the no-memory condition C1 is reported beside every point.
- **Results:** research/results/h2-*

### H3. Lints recover part of the governance loss

- **Statement:** Adding lints to enforcement (C6) recovers part of the utility enforcement loses (C5) at matched token budget, and deterministic lints alone find seeded faults with useful precision; keyed and unkeyed items are reported separately.
- **Conditions:** C5, C6
- **Benchmarks:** LongMemEval
- **Metric:** utility recovery (C6 minus C5 accuracy on LongMemEval at matched budget), and lint precision and recall per fault class on the seeded-fault set of card L2.
- **Test:** paired bootstrap of C6 minus C5; the primary test is the deterministic tier on M1; model-based lints are reported as a separate tier.
- **Stopping rule:** fixed sample: all 500 questions and the full seeded-fault set, three seeds.
- **Analysis:** supported if the C6 minus C5 interval lies above zero; per-class precision and recall are reported with intervals, the expired-validity lint only on keyed items (`docs/readings/litreview/sota-2026.md`).
- **Results:** research/results/h3-*

### H4. The plane is store-, model- and harness-agnostic

- **Statement:** Under enforcement (C5) the violation rate does not depend on the store or the model, and the MCP path without read filtering (C7) is measured as its own, weaker condition.
- **Conditions:** C2, C5, C7
- **Benchmarks:** GateMem, MemoryAgentBench
- **Metric:** violation rate per store (files, Mem0, Letta) and per model (M1 to M3); utility gap between stores.
- **Test:** two one-sided tests of equivalence of C5 violation rates across stores and across models (proposed margin: 2 percentage points); paired bootstrap of C7 minus C5.
- **Stopping rule:** fixed subsets per model as in the Models section; a store that fails the conformance suite is excluded and the exclusion is reported (roadmap Gate B response). Power: about 100 items per model is likely too few for a 2-point equivalence margin; the sample needed is computed from the pilot variance before `prereg-v1`, and the margin or the subset is amended then.
- **Analysis:** supported if every pairwise equivalence holds within the margin; the C7 minus C5 difference is reported as a limitation whatever its sign.
- **Results:** research/results/h4-*

### H5. Governed procedural memory is net positive

- **Statement:** Procedures induced from sessions and admitted only after replay validation (C5) raise task success over the same induction admitted without governance (C2), and both are reported beside no procedural memory (C1).
- **Conditions:** C1, C2, C5
- **Benchmarks:** tau2-bench
- **Metric:** task success (tau2 reward), steps per task, and policy violations, on held-out tasks.
- **Test:** paired bootstrap of C5 minus C2 success on M1, with the same induction method (Agent Workflow Memory, ADR 0012) in both.
- **Stopping rule:** fixed sample: the airline and retail test splits, three seeds; replay validation admits a procedure at k of n runs (proposed: 4 of 5).
- **Analysis:** supported if the C5 minus C2 interval lies above zero; the gain over C1 is reported but is not the test, since a positive over no memory with a negative over ungoverned would not support H5.
- **Results:** research/results/h5-*

## Proposed amendments, not yet registered

- HaluMem (roadmap card B8) for H3's per-operation error rate: not pinned, so not part of v0.
- MEM-INV-Bench (2606.24322) as the MPBench alternative named in the literature review.

## Versions

| version | date | change |
|---|---|---|
| v0 | 2026-10-22 | first complete draft; hypotheses reconstructed, thresholds proposed, models pending |
| v0.1 | 2026-10-22 | review fixes: Holm adjusts p-values, not intervals; H4 power caveat; models must be concrete from v1 |
| v0.2 | 2026-10-25 | wording fix to C5 and C6: the condition, not the preset, decides whether lints run; a preset's `lints.enabled` is the list C6 runs |
