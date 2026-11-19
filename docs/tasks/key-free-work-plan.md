# Plan: the work that can be done now, before the lead's answers and a key

Status: proposed 2026-11-19 by the orchestrating session on the lead's instruction ("we want to do any and all work that can be done now rather than later (starting with a 3 pr plan) or is waiting on me, and then give me a list of items that absolutely need me"). Each PR follows AGENTS.md and the two conventions, one card per PR (rule 10).

## 1. Where the repository stands

- The pre-registration v1 plan is done (#24 to #27). v1 is drafted and untagged. The decision sheet (`docs/research/prereg-v1-decisions.md`) is unanswered, so H1, and with it Gate C (13 December), waits on the lead, not on code.
- Twelve cards merged on 2026-11-13 (#28 to #39) and their integration fixes (#41): E9.1, E9.2, E9.7, E8.9, PX2, PX3, L1, the engineering half of B5, schema version 1, `@engram/model`.
- Gate D (week 16) needs three things: the frontier figure (after Gate C, live), seeded-fault lint precision and recall (cards L2, L3, L4, all buildable offline), and the Knowledge and Twin profiles on dogfood data with zero violations (the twin dogfood, E9.5, takes two weeks and waits on E9.4).

## 2. Goal

Do every piece of work that needs neither the lead's answers nor a model key, in the order that shortens the gates most. Separately, put every item that needs the lead into one place, each as a multiple-choice question with a recommendation, so the lead can close them in one sitting.

## 3. Decisions taken by this plan

1. **Three PRs first, in parallel:** L2, L3 and E9.4. They touch different files, and each unblocks a Gate D criterion: L2 and L3 lead to L4's table, and E9.4 lets the two-week twin dogfood start.
2. **L2 and L3 land before the tag where possible.** v1 measures H3 "on the seeded-fault set of card L2". A generator, seed and model-lint prompts fixed before `prereg-v1` let the answers PR name them in v1; after the tag they would be amendments.
3. **Model-based work is built offline.** L3's lints take an injected `ModelCall` (rule 4) and are tested on scripted models and committed cassettes. The live acceptance (variance across three seeds) waits for the key, with its config counted by `COUNT=1`, as B5's engineering half was.
4. **A grant change is a governed write.** E9.4's acceptance ("grant change recorded as an event") needs a core operation that does not exist yet. It is added in core, behind the gate, with an ADR, without a schema change. If a schema change proves unavoidable, it becomes its own PR (rule 5), and E9.4 waits for it.
5. **The lead's items are one page of multiple-choice questions.** The page collects the decision sheet's items, the proposed ADRs and amendments, and the backlog rows that name the lead. When the answers come back, one PR writes them into the repository.

## 4. Wave 1: three PRs

### PR 1. L2: the seeded-fault set

Files: `packages/bench/src/faults/` or `research/` (the generator reaches core's types and B5's LongMemEval memory through an entry point), `research/configs/`, `research/scripts/`, `research/results/h3-*`, fixtures for tests.

- A seeded generator that injects four labelled fault classes into a LongMemEval memory state built as B5 builds it:
  - stale: past its validity, or its source changed;
  - contradictory: an active item contradicting another;
  - misplaced: the wrong scope or class;
  - unsupported: missing provenance, or a claim its provenance does not support.

  Each injected item carries its class and the lint or lints expected to find it. Unfaulted near-miss items sit beside them, so that precision means something. Labels never reach a model prompt or the plane.
- Keyed and unkeyed items are reported separately, as H3 requires.
- The full set is generated from LongMemEval's pinned cleaned S split (fetched at the pin into `.engram/upstream`, data only), and only counts and hashes are committed: a rule-9 result with counts per class. A fixture-size set built from B5's committed subset backs the tests.
- Acceptance: the result regenerates under `make test-repro`, and `make test` passes.

### PR 2. L3: the model-based lints

Files: `packages/core/src/lint/model.ts` (no pi-ai import; a `ModelCall` is injected), its tests, and a runner or bench entry point that builds the `ModelCall` on `@engram/model` (cached, seeded).

- Two lints, following L1's lint event shape and evidence rules (ADR 0009's post-merge amendment on evidence outside the linted scope): contradiction between active semantic items, and a claim unsupported by its provenance.
- The prompts are fixed. Each call carries the config's seed and is cached on the rule 7 key.
- Tests run on scripted models and committed cassettes, recorded by `make fixtures`.
- The pilot-set variance config exists and is counted by `COUNT=1`; its run needs the key.
- Acceptance: the lints' tests and a cassette replay that makes zero new calls.

### PR 3. E9.4: the twin screens

Files: `packages/ui/` (the grants editor, person versus role lanes), the server route and generated client (`make api`), and the minimal core operation.

- The owner adds or removes a grant on an item through the plane. Every change is a governed write: the gate validates it (ADR 0021, decision D4: a principal or a prefixed pattern, a class and an expiry), and emits a MemoryEvent with `reason` and `policy_id` (rule 3). There is no schema change.
- The inspector shows a member's person scope and role scopes as separate lanes, under the twin profile.
- Acceptance: a grant change is recorded as an event (a test against the real Plane, plus the inspector's Chromium e2e test).

## 5. Later waves (key-free, each started when its dependency merges)

- **L4**, after L2 and L3: precision and recall per fault class; the deterministic floor offline, the model-based delta from cassettes, with the live delta waiting for the key.
- **B6's engineering half**: the cleaned S split vendored (backlog row "LongMemEval split"), the enforced-baseline config, its count and cost.
- **B7**: MERIT through the plane, with cost accounting.
- **E9.5's kit**, after E9.4: the dogfood procedure and a violation-report script. The two weeks start on the lead's go.
- **D1**: the session recorder for H5.
- Backlog follow-ups that need no decision, one card each: Letta's delete refusals as `NotDeletableError`, a surface for deletion reports, `memory_lint` in the pi extension, and offboarding as a Plane method under the invariants.
- **After the lead's answers:** the answers PR (section 7 of `docs/tasks/prereg-v1-plan.md`), then the tag.

## 6. What needs the lead

One page of multiple-choice questions, each with a recommendation: the decision sheet's 27 answer lines; ADRs 0031 to 0033 and the 2026-11-13 amendments; the backlog rows that name the lead; the label-audit members; the deposit venue; the key and a spend ceiling; the MPBench request; HaluMem's registration for H3; and the twin dogfood's members and start.
