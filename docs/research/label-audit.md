# The label audit: how two members do it

The pre-registration requires that before any run, 50 items per benchmark are label-audited by two members and the disagreement rate is reported (ADR 0015; `docs/tasks/prereg-v1-plan.md`, decision 9). This page is the procedure for H1's two benchmarks. The kit draws the items and computes the rates; the members do the reading. Nothing here calls a model.

The audit is blind: a member labels every item before seeing what the benchmark says about it. It runs in two phases, and the second cannot be written until a member has finished the first.

## What is audited

| benchmark | items | phase 1: the member's own label | phase 2: the key check |
|---|---|---|---|
| GateMem | 50 checkpoints of the pinned full set, seeded: 25 access control and 25 active forgetting (the items H1's violation rate is computed on), mixed in one seeded order and named G01 to G50 | what the assistant should do: `answer`, `answer_redacted`, `refuse` or `no_memory` | are the scoring keys (the leak targets and the patterns the judge must not see) what the asker must not learn? `yes` or `no` |
| MEM-INV-Bench | all 38 cases of the vendored full set (fewer than 50), in a seeded order, named M01 to M38 | `attack` (acting on the memory would commit a value someone planted) or `legit` | are the scoring keys (the poisoned and the legitimate value, or the legitimate value) the values that decide the outcome? `yes` or `no` |

The draw is fixed by the seed in `research/configs/label-audit.json`; drawing it again gives the same items in the same order.

## What a member sees in phase 1

Each item's context file shows what an agent sees, and nothing else.

- **GateMem:** who asks and as of which turn, the question, the episode's people and relationships, and every turn up to the question.
- **MEM-INV-Bench:** the task and the text of each memory entry. Not the channel an entry came through or what it was derived from: under C2 and C3 the model sees only the text.

Phase 1 shows no checkpoint id, kind, expected action, leak target, judge spec, family, laundering channel or scoring value. The phase-1 sheet has a reference, the benchmark, the context file's path, and two empty columns: `member_label` and `member_comment`.

Leak targets and poisoned values do appear inside the turns and the memory, because they are the content being judged; what phase 1 withholds is which phrase the benchmark marks.

## Steps

1. One member draws the kit, once, on a machine with the pinned GateMem data (it is fetched at the pin when missing):

   ```
   uv run python research/scripts/label_audit_sample.py --config research/configs/label-audit.json
   ```

   - It writes, under `.engram/audit/` (git ignores `.engram/`), one phase-1 sheet per benchmark and member: `gatemem-member1.csv`, `gatemem-member2.csv`, `mem-inv-bench-member1.csv` and `mem-inv-bench-member2.csv`.
   - It writes one context file per item under `context/<benchmark>/`.
   - To use names instead of `member1` and `member2`, change the config's `members` before drawing.
   - The sampler refuses to write inside the repository outside `.engram/`, and refuses to overwrite a sheet that exists.

2. **Phase 1.** Each member fills their own two sheets alone, without seeing the other's and without opening the data files. For each row, read the context file, then fill:
   - `member_label`: your label, in the vocabulary above.
   - `member_comment`: anything that made the item hard.

3. **Phase 2.** When your phase-1 sheets are complete, write your key sheets:

   ```
   uv run python research/scripts/label_audit_sample.py --config research/configs/label-audit.json --phase 2 --member member1
   ```

   - It refuses while any of your phase-1 labels is blank or outside the vocabulary.
   - It writes `gatemem-member1-keys.csv` and `mem-inv-bench-member1-keys.csv`, each showing every item's scoring keys.
   - For each item, fill `member_keys_ok` with `yes` or `no`, and `member_comment` with your reason when the answer is no.
   - Do not change your phase-1 labels after seeing the keys.

4. Put both members' sheets in one folder and run:

   ```
   uv run python research/scripts/label_audit_agreement.py --config research/configs/label-audit.json --dir .engram/audit --members member1,member2
   ```

   - The benchmark labels come from the pinned data through the same seeded draw, never from a sheet.
   - It writes `.engram/audit/agreement.json` and prints, per benchmark:
     - the members' disagreement count and rate on the label, and Cohen's kappa;
     - each member's disagreement with the benchmark's label;
     - the items both members label otherwise than the benchmark, by reference;
     - once both members' key sheets exist, the same agreement on the keys;
     - the items both members reject and the stop flag (below).
   - A blank or unknown label, or a sheet whose items differ from the draw, is refused, with the items named.

   **The stopping rule.** It applies to what decides a violation, with the threshold `stop_share` (0.10) from `research/configs/label-audit.json`:
   - On GateMem an item is rejected when both members answer `no` on its scoring keys: the leak targets decide every violation. The agreement on the expected action is reported, but it stops nothing.
   - On MEM-INV-Bench an item is rejected when both members' phase-1 label differs from the benchmark's family, or both answer `no` on its keys. An item rejected both ways counts once.
   - `agreement.json` gives, per benchmark, `rejected` (the rule, the references and their count), `stop_share` and `stop`.
   - `stop` is true when more than `stop_share` of the benchmark's items are rejected: 6 or more of GateMem's 50, 4 or more of MEM-INV-Bench's 38. It is false once both members' key sheets are in and the count is at or below that, and null before then, unless the rejections counted so far already exceed it.
   - When `stop` is true, that benchmark's runs wait for an amendment.

5. **Report it.** `agreement.json` holds counts and references only, no benchmark text.
   - Write a `finding` log entry (`docs/conventions/documentation.md`) with the rates and kappas per benchmark, the sha256 of `agreement.json`, the references both members reject, and each benchmark's `stop`.
   - The pre-registration reports the members' disagreement rate per benchmark.
   - An item both members reject is a candidate label error. List it in v1; do not silently drop it.

Do not commit the sheets or the context files: they hold benchmark content, and filled sheets are a member's own reading.

## A second audit: PR 2's reachable-leak sample

`research/results/h1-gatemem-reach.json` holds an `audit_sample` (from `research/scripts/h1_gatemem_reach.py`, PR 2 of the plan):

- 50 seeded GateMem checkpoints, 25 access control and 25 active forgetting;
- for each, the scored leak patterns that sit in turns the asker can read under ADR 0030's mapping, with every pattern and every turn it matches.

It answers a different question: whether a text match is the secret or a coincidence, and so how much of the reachable-leak share is real. The same two members can read it after the label audit and record, for each checkpoint, whether the matched turn holds the secret. The share they agree is real is the evidence v1's forgetting decision rests on.

## Files

- `research/configs/label-audit.json`: the seed, the members, the stopping rule's `stop_share`, the sample sizes and the data.
- `research/scripts/label_audit_sample.py`: the draw, the blind phase-1 sheets and contexts, and the phase-2 key sheets.
- `research/scripts/label_audit_agreement.py`: the agreement, with labels from the draw, and the stopping rule.
- `research/tests/test_label_audit.py`. It checks:
  - that each phase-1 context equals what an agent sees, rebuilt from the data, so nothing appended to it passes;
  - that no phase-1 sheet or context holds an item's label, key, family or kind;
  - the seeded, mixed order;
  - that phase 2 is refused until phase 1 is complete;
  - the agreement against labels from the draw, with a kappa computed by hand;
  - that a sheet cannot change the benchmark label;
  - the stopping rule above and below the threshold on both benchmarks, and the stop flag waiting for the keys.
