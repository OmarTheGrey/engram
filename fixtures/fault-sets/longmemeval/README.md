# LongMemEval seeded-fault set, fixture size (card L2)

The seeded-fault generator (`packages/bench/src/faults/`) run on the vendored LongMemEval subset of card B5 (`fixtures/bench/longmemeval/questions.jsonl`, 20 questions of the oracle release), with the seed and count per question of H3's config (`research/configs/h3-fault-set.json`). It backs the tests (`packages/bench/test/faults/`) and is the set a later card can lint without the full split. The full set, over the cleaned S split at the pin, is built by `research/scripts/h3_fault_set.py` into `.engram/faults/h3-fault-set/` and only its counts and hashes are committed (`research/results/h3-fault-set.json`).

Regenerated only by `make fixtures`:

```
node packages/bench/scripts/fault-set.ts --data fixtures/bench/longmemeval/questions.jsonl --config research/configs/h3-fault-set.json --out fixtures/fault-sets/longmemeval
```

| file | what it holds |
|---|---|
| `policy.json` | the lint-time policy every state is linted under: preset medium without the person scope's ttl, every lint enabled, version 2 (the role scope forbids episodic items; at write time, version 1, it did not) |
| `states.jsonl` | one memory state per question: `question_id`, the lint time `at` (B5's read time), the linting `actor`, the `scopes` to lint, and the event log `events` the Plane wrote |
| `labels.jsonl` | one label per injected fault or near-miss (below) |
| `stats.jsonl` | per question: B5's turns, the assistant turns whose model the generator names, the turns past preset medium's own ttl at the lint time, the turns L1's missing-provenance lint would flag as B5 writes them, and the events |

## Labels

Each label names its item (`item_id`, `scope`), `kind` (fault or near-miss), `class`, `subtype`, whether it is `keyed` (what makes it faulty is a field the plane records, not only item text), the lints of each tier `expected` to flag it, the lints it is a near-miss of (`near_miss_of`), the `related` items it is about, `finding_on` and `variant`.

- `finding_on` is the item a finding of the label's lints lands on. It is the labelled item, except for a pair card L3's contradiction lint judges: L3 flags the later item of a pair by id, naming the earlier. A conflict's restatement is the later item and is flagged itself; a superseded statement is the earlier of its pair, so the finding lands on its later restatement. Score model findings by `finding_on`.
- `variant` says how a pair was built, for the two subtypes with more than one way: expired-validity (`valid_to` or `ttl`) and unsupported-claim (`other-attribute`, `other-value`, `qualifier-dropped`, `qualifier-added`); null otherwise.
- Superseded recall measures how the model reads L3's contradiction prompt, which asks whether two statements "cannot both be true at the same time" and sends no times: a model may call an old value and a later one consistent, as two states at different times. Report it apart from conflict recall.

Near-misses sit at the boundary: an expired-validity near-miss's validity ends one millisecond after the lint time (its fault's exactly at it), and so does the orphan near-miss's source. A supersession, a conflict and their near-misses draw from one pool of restatements with no cue word, so only the value tells them apart.

## Limits

What the set can tell: a regression check on L1's deterministic lints (each keyed subtype restates its lint's trigger, so deterministic recall and precision on the labelled items are 1.0 by construction while the lints are correct); model-tier accuracy on clean, pre-paired cases as an upper bound (every model-tier item is an injected template that L3's planning is checked to send, which leaves out the pair-selection misses natural prose causes); and the gaps: no lint of either tier is built for wrong-scope, and the deterministic tier finds no unkeyed fault.

What it cannot tell: how common these faults are (one of each per question, by design), real-world recall (the faults are templates), or precision on natural memory without the audit (findings on LongMemEval's own items are counted, not verified, until members judge the audit sample the full run writes under `.engram/faults/h3-fault-set-audit/`).

Per-class figures pooled over keyed and unkeyed faults depend on the generator's mix: stale 2 keyed to 1 unkeyed, unsupported 2 to 1, misplaced 1 to 1, contradictory 0 to 1. Report keyed and unkeyed apart.

How the set differs from what B5, B6 and X10 run, with the full split's counts from `research/results/h3-fault-set.json`: assistant turns name a model (`longmemeval/assistant`), where B5's name none and L1's missing-provenance lint would flag all 124,334 of them; the policy is preset medium without its person-scope ttl, while under medium 11,122 turns in 54 questions are past the 90-day ttl at the read time; and under medium with every lint enabled, L3's planning would not send 45 of the 1,000 labelled unsupported-claim units, because their source is past the ttl.

## Reading the files

To lint a state, append its events to a fresh log (`appendEvent`, without `seq`), build a plane over it with `policy.json`, and call `Plane.lint(actor, at, scope)` for each scope; `packages/bench/scripts/fault-set-check.ts` does so, plans L3's model units with `planModelLints`, and checks the labels against both. A base item (one of LongMemEval's turns) is one whose provenance ref starts with `longmemeval:`; the generator never writes one. The labels never appear in a state; a scorer joins them by `question_id` and `item_id`.

Split the JSON Lines files on the newline byte only: LongMemEval's text holds U+2028, which `JSON.stringify` leaves raw and `node:readline` (or Python's `str.splitlines`) treats as a line end.

Content: LongMemEval's turns are upstream's (MIT licence, Copyright (c) 2024 Di Wu; see `fixtures/bench/longmemeval/UPSTREAM-LICENSE`). Every injected sentence and value is invented (`packages/bench/src/faults/bank.ts`).
