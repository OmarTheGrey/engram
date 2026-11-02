# The label audit: how two members do it

The pre-registration requires that before any run, 50 items per benchmark are label-audited by two members and the disagreement rate is reported (ADR 0015; `docs/tasks/prereg-v1-plan.md`, decision 9). This page is the procedure for H1's two benchmarks. The kit draws the items and computes the rates; the members do the reading. Nothing here calls a model.

## What is audited

| benchmark | items | the label a member gives | the scoring keys a member checks |
|---|---|---|---|
| GateMem | 50 checkpoints of the pinned full set, seeded: 25 access control, 25 active forgetting (the items H1's violation rate is computed on) | the expected action: `answer`, `answer_redacted`, `refuse` or `no_memory` | the leak targets: are they what the asker must not learn? `yes` or `no` |
| MEM-INV-Bench | all 38 cases of the vendored full set (fewer than 50) | `attack` or `legit`: would acting on the memory's value commit what an attacker planted? | the poisoned and legitimate values: are they the ones that decide the outcome? `yes` or `no` |

The sample is fixed by the seed in `research/configs/label-audit.json`; drawing it again gives the same items.

## Steps

1. One member draws the kit, once, on a machine with the pinned GateMem data (fetched at the pin when missing):

   ```
   uv run python research/scripts/label_audit_sample.py --config research/configs/label-audit.json
   ```

   It writes, under `.engram/audit/` (git ignores `.engram/`): one sheet per benchmark and member, `gatemem-member1.csv`, `gatemem-member2.csv`, `mem-inv-bench-member1.csv`, `mem-inv-bench-member2.csv`, and one context file per item under `context/<benchmark>/`. Rename the members in the config's `members` before drawing if you prefer names. The sampler refuses to write inside the repository outside `.engram/`, and refuses to overwrite a sheet that exists.

2. Each member fills their own two sheets alone, without seeing the other's. For each row, read the row's context file (the question, the episode's people and every turn up to the as-of turn for GateMem; the task and the memory for MEM-INV-Bench), then fill:
   - `member_label`: your own label, in the vocabulary above, decided before you look at `benchmark_label`, as far as you can;
   - `member_targets_ok`: `yes` or `no`;
   - `member_comment`: anything that made the item hard, and why you disagree with the benchmark if you do.

3. Put both members' filled sheets in one folder and run:

   ```
   uv run python research/scripts/label_audit_agreement.py --dir .engram/audit --members member1,member2
   ```

   It writes `.engram/audit/agreement.json` and prints, per benchmark: the members' disagreement count and rate on the label and Cohen's kappa; each member's disagreement with the benchmark's label; the items both members label otherwise than the benchmark; and the same agreement on the scoring keys. A blank or unknown label, or two sheets with different items, is refused with the items named.

4. Report it. `agreement.json` holds counts and item ids, no benchmark text. Write a `finding` log entry (`docs/conventions/documentation.md`) with the rates and kappas per benchmark, the sha256 of `agreement.json`, and the items both members label otherwise than the benchmark. The pre-registration reports the members' disagreement rate per benchmark; an item both members reject is a candidate label error, to be listed in v1, not silently dropped.

Do not commit the sheets or the context files: they hold benchmark content, and filled sheets are a member's own reading.

## A second audit: PR 2's reachable-leak sample

`research/results/h1-gatemem-reach.json` holds an `audit_sample`: 50 seeded GateMem checkpoints whose scored leak patterns sit in turns the asker can read under ADR 0030's mapping (25 access control, 25 active forgetting), each with every pattern and every turn it matches (`research/scripts/h1_gatemem_reach.py`, PR 2 of the plan). It answers a different question: whether a text match is the secret or a coincidence, so how much of the reachable-leak share is real. The same two members can read it after the label audit and record, per checkpoint, whether the matched turn holds the secret; the share they agree is real is the evidence the forgetting decision of v1 rests on.

## Files

- `research/configs/label-audit.json`: the seed, the members, the sample sizes and the data.
- `research/scripts/label_audit_sample.py`: the sampler.
- `research/scripts/label_audit_agreement.py`: the agreement.
- `research/tests/test_label_audit.py`: the sampler's seeding and stratification, the full MEM-INV-Bench sample, and the agreement on two synthetic filled sheets (a hand-computed kappa of 0.6).
