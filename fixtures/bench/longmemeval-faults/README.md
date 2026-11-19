# LongMemEval seeded-fault set, fixture size (card L2)

The seeded-fault generator (`packages/bench/src/faults/`) run on the vendored LongMemEval subset of card B5 (`fixtures/bench/longmemeval/questions.jsonl`, 20 questions of the oracle release), with the seed and count per question of H3's config (`research/configs/h3-fault-set.json`). It backs the tests (`packages/bench/test/faults/`) and is the set a later card can lint without the full split. The full set, over the cleaned S split at the pin, is built by `research/scripts/h3_fault_set.py` into `.engram/faults/h3-fault-set/` and only its counts and hashes are committed (`research/results/h3-fault-set.json`).

Regenerated only by `make fixtures`:

```
node packages/bench/scripts/fault-set.ts --data fixtures/bench/longmemeval/questions.jsonl --config research/configs/h3-fault-set.json --out fixtures/bench/longmemeval-faults
```

| file | what it holds |
|---|---|
| `policy.json` | the lint-time policy every state is linted under: preset medium without the person scope's ttl, every lint enabled, version 2 (the role scope forbids episodic items; at write time, version 1, it did not) |
| `states.jsonl` | one memory state per question: `question_id`, the lint time `at` (B5's read time), the linting `actor`, the `scopes` to lint, and the event log `events` the Plane wrote |
| `labels.jsonl` | one label per injected fault or near-miss: its item, scope, class, subtype, whether it is keyed, the lints of each tier `expected` to flag it, the lints it is a near-miss of, and the `related` items it is about |
| `stats.jsonl` | per question: B5's turns, the assistant turns whose model the generator names, the turns past preset medium's own ttl at the lint time, and the events |

To lint a state, append its events to a fresh log (`appendEvent`, without `seq`), build a plane over it with `policy.json`, and call `Plane.lint(actor, at, scope)` for each scope. The labels never appear in a state; a scorer joins them by `question_id` and `item_id`.

Content: LongMemEval's turns are upstream's (MIT licence, Copyright (c) 2024 Di Wu; see `fixtures/bench/longmemeval/UPSTREAM-LICENSE`). Every injected sentence and value is invented (`packages/bench/src/faults/bank.ts`).
