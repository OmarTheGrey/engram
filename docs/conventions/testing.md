# Convention: testing methodology

Engram makes two promises (no read returns an item its scope or grants exclude; no write lands in a scope that forbids its class or source) and one research claim (enforcement beats instruction at a measurable cost). Testing exists to make the promises hold on every commit and to make the claim reproducible by a stranger. Everything below follows from that.

## Layers

Every change lands in the lowest layer that can catch its failure. A PR says which layers it touched.

| layer | what it covers | tool | where | budget |
|---|---|---|---|---|
| 1 unit | pure functions in `packages/core`: schema validation, policy evaluation, lint rules, scoring, explanation assembly | vitest | `packages/core/test/unit/` | under 60 s total |
| 2 property | the two invariants and every lifecycle rule, over generated items, scopes, grants and policies | vitest + fast-check | `packages/core/test/property/` | under 90 s |
| 3 replay | an event log replays to the same state; a state produces the same explanation; golden session fixtures replay through the plane to the same decisions | vitest | `packages/core/test/replay/`, fixtures in `fixtures/` | under 60 s |
| 4 conformance | every adapter against the Adapter contract, first on the in-memory fake, then on the real store in a CI service container | vitest | `packages/adapters/test/conformance/` | under 5 min |
| 5 harness | the pi extension inside a real pi SDK session with an in-memory session manager and a scripted model: writes are gated, reads are filtered, events are mirrored, bash bypasses are blocked | vitest | `packages/pi-extension/test/` | under 3 min |
| 6 end to end | `engram doctor` and a CLI smoke on SQLite and on embedded Postgres, MCP server handshake from a Claude Code and a Codex fixture; no Docker (Postgres from the embedded-postgres package, card E1.1) | vitest (`make test-e2e`, its own config) | `test/e2e/` | under 10 min, on main and nightly |
| 7 benchmark fixture | each benchmark runner on a fixed subset of about 20 items, scripted model, cached; asserts the pipeline, not the score | vitest | `packages/bench/test/` | under 5 min |
| 8 reproducibility | every `research/scripts/<name>.py` regenerates its results file from its config and the hash matches `MANIFEST.md`; analysis on synthetic data with a known effect recovers it | pytest | `research/tests/` | under 10 min, nightly |

CI runs layers 1 to 5 and 7 on every PR, 6 and 8 on main and nightly. A PR that touches `packages/core/src/schema.ts` or `policy/` runs everything.

## The invariants are always on

`packages/core/test/property/invariants.test.ts` generates random policies, scopes, grants, items and actors and asserts, for thousands of cases per run:

- `Plane.read(actor, query)` never returns an item whose scope the actor is not in and for which no grant exists.
- `Plane.write(actor, item)` never lands an item in a scope whose policy forbids its class or its source.
- Every denied read or write produced exactly one event with a reason and a policy id.
- Replaying the events produced by any sequence of writes yields the same store state and the same read results.
- After any write sequence no scope holds more active items of a class, not past their ttl, than its recency or utility budget; each write's and each sweep's retirements are exactly the oracle's (a manual rule asks once per overage state); every retire or evict event carries a reason and a policy id, and replay reproduces them (card E2.4, ADR 0025).

Invariant 1's oracle also excludes an item past its ttl, and invariant 2's forbids a model, compaction or tool write restating content an allowed retire or evict event retired in its scope (ADR 0025). Invariant 2 also runs promotions (card E2.5, ADR 0026): one that lands was asked for by an actor who can read the item and is a member of its scope (or its owner in the owner's person scope: a read grant never moves an item), of an item not retired, not past its ttl and free of hidden characters, by a user-sourced actor when the scope changes, with no active item of the promoted class already holding the content in the target, and with the evidence ADR 0026 asks for (k distinct actors with trusted sources among items still active, or a reviewer who is user-sourced, a member of the target, not the owner, not an author of any version and not a confirmer); its item is one a write could land in the target. The oracle judges all of this from its own scan of the events. Invariant 1 also checks that no Plane method other than `read` hands an item to an actor who cannot read it, a promoter included.

This file is owned by the lead. Changing it needs a second reviewer and a `decision` log entry. It never has a skip.

## Fakes, not mocks

- Never mock the plane. Tests drive `Plane.read` and `Plane.write` and assert on events and results.
- Stores are faked, not mocked: `packages/adapters/src/fake/` is a complete in-memory adapter that passes the conformance suite. Every test above layer 1 that needs a store uses it unless the test is specifically about a real store.
- Models are scripted, not mocked: `packages/runner/src/model/scripted.ts` is a `ModelCall` that answers from a table keyed on a hash of the request, and fails loudly on an unknown key. Real-model tests use the cache as a cassette: the first run records under a seed, later runs replay with zero calls. Cassettes are committed as fixtures under `fixtures/cassettes/` and are the only way a real model enters CI. A runner config's scripted cassettes are recorded only by `make fixtures`, which records them afresh; `make run` replays, and a miss is an error.
- Time is injected. Nothing in `packages/core` reads the clock; validity and retention tests pass a clock.
- Randomness is seeded. Any test that samples takes its seed from the test name; a failing case prints the seed and the case so it can be rerun by itself.

## Fixtures

- `fixtures/sessions/`: pi session JSONL files (version 3) that exercise one behaviour each: a write denied, a read filtered, a bash bypass blocked, a branch abandoned, a compaction. Each has a sibling `.expected.json` with the decisions and events the plane must produce. Regenerated only by `make fixtures`, which fails if the diff is not explained in the PR.
- `fixtures/stores/`: snapshot states for each adapter at known points, used by replay and conformance tests.
- `fixtures/faults/`: the seeded-fault catalogue (expired validity, changed source, scope mismatch, missing provenance, orphan, duplicate, contradiction, unsupported claim, each MPBench attack class). Every lint has a fixture that it must flag and a near-miss fixture that it must not.
- `fixtures/cassettes/`: recorded model responses keyed by (benchmark item, condition, preset, store, model, seed, prompt hash) (ADR 0017).

Golden files are updated by a command, never by hand, and the update is its own commit with the reason in the message.

## Per-card requirements

- A card ships its acceptance test before its implementation. The acceptance test is not modified by the card's PR; if it is wrong, a separate PR fixes it with a `change` log entry.
- Every new public function in `packages/core` has a unit test. Every new lint has a flag fixture and a near-miss fixture. Every new event type has a replay test. Every new policy rule has a property test case. Every new adapter method has a conformance case.
- A bug fix starts with a failing test that reproduces it, in the first commit of the PR.
- Coverage is reported per package, not enforced globally. `packages/core` stays above 90 percent lines and 100 percent branches on `policy/` and `invariants`. A drop blocks merge.

## Experiments are tests too

- An experiment is a config under `research/configs/` and a script under `research/scripts/`. The script is deterministic given the config, the cache and the seed.
- `research/tests/test_reproduce.py` runs every script on its config in replay mode (cache only, no network) and compares the output hash to `MANIFEST.md`. A result that cannot be reproduced is removed from the manifest and from the thesis.
- `research/tests/test_analysis.py` feeds the analysis code synthetic data with a planted effect and a planted null and checks the bootstrap intervals and the Holm-corrected decisions come out right. The statistics are tested before they see real data.
- The pre-registration file is checked by `research/tests/test_prereg.py`: every hypothesis names its conditions, benchmarks, metric, test and stopping rule, and every results file in the manifest maps to one hypothesis.

## Flaky tests

A test that fails without a code change is quarantined the same day: marked `@quarantine` with an issue link, excluded from the merge gate, and fixed or deleted within five working days. The nightly run executes quarantined tests and reports them. More than three quarantined tests at once stops feature work until they are cleared.

## Review checklist for tests

Reviewers check, in order:

1. Does the test fail if the behaviour is removed? Reviewers may ask for the failing run.
2. Does it use the fake store and a scripted model rather than a mock of the plane?
3. Is every seed, clock and path explicit?
4. Does a golden-file change come with a reason?
5. Is the acceptance test untouched?
6. Is the invariants file untouched, or touched with a second reviewer?

## Naming and placement

- Test files mirror source files: `src/policy/evaluate.ts` is tested by `test/unit/policy/evaluate.test.ts`.
- Test names state the behaviour and the condition: `denies write of personal class into team scope when policy forbids it`.
- One assertion subject per test. Several assertions about that subject are fine.
- No test reads the network. `ENGRAM_OFFLINE=1` is set in CI and the runner refuses any model call that misses the cache.

## Commands

```
make test               layers 1 to 5 and 7
make test-e2e           layer 6
make test-repro         layer 8
make fixtures           regenerate golden files; refuses without a message
make test-one T=<path>  one file, with its seed printed
```
