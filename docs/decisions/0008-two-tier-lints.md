# ADR 0008: Lints: deterministic first, model-based second, both as events

Status: accepted, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

HaluMem (evaluate per operation, not end to end); the knowledge-conflicts taxonomy (inter-context conflicts need detection, and resolution is policy); Ground Truth First (write-stage errors track downstream failure).

## Decision

(a). A lint finding is an event with `lint_id`, `severity`, `evidence`. Model-based lints take an injected `ModelCall`, are seeded and cached, and are reported separately in H3. Each lint ships a flag fixture and a near-miss fixture.

Amendments made in the review fix pass, 2026-10-25:

- D2, lints and conditions: a preset's `lints.enabled` lists the lints a lint-running condition (C6) uses; it does not turn lints on. C5 is the write gate and the read filter only, whatever the preset says. The presets' comments and the C5 and C6 rows of `docs/research/preregistration.md` (v0.2) say so.
- D2, one registry: lint ids come from `LINT_IDS` in `packages/core/src/lint.ts` (deterministic: expired-validity, source-changed, scope-class-mismatch, missing-provenance, orphan, duplicate; model-based: contradiction, unsupported-claim). `replay-drift` and `environment-changed` are procedural lifecycle triggers of ADR 0011 and live in their own list, `LIFECYCLE_TRIGGERS`. `near-duplicate` is a threshold key, not a lint; the threshold keys are `LINT_THRESHOLD_KEYS` (near-duplicate, replay-drift.success-floor, replay-drift.min-trials). The policy loader rejects an unknown or duplicate lint id and an unknown threshold key at its line.

Proposed amendment made in card L3, 2026-11-19, for the lead's acceptance (plan `docs/tasks/key-free-work-plan.md`, PR 2; one decision entry each under `docs/log/2026-11-19-l3-decision-*`):

- The model-based tier is `packages/core/src/lint/model.ts`. `Plane.lint` runs it after the deterministic tier when the plane is built with `PlaneDeps.lintModel` (the injected `ModelCall`, its model and the config's seed); without one the model lints do not run, so the server and CLI, which inject none, are unchanged.
- Units are chosen without a model. contradiction: two active semantic items of the linted scope, both held at the lint time, not exact duplicates by the strict hash, sharing a term; each item is paired with its 5 nearest by the Jaccard share of their terms (runs of letters and digits, lower-cased), ties to the items that follow it in id order, wrapping round, so newer items get the same share of pairs (review L3-5); a contradiction verdict flags the later item by id and names the earlier. unsupported-claim: an active episodic or semantic item of the scope, held at the lint time, whose provenance ref names another item the actor can reach, active, held at the lint time, whose strict content hash is the one the claim recorded; a changed, gone or expired source is left to source-changed, orphan and expired-validity, and an expired claim to expired-validity (review L3-4).
- Requests are fixed but for their inputs, model and seed: the system prompt `LINT_PROMPTS`, the inputs as one canonical JSON user message, temperature 0, 256 output tokens, and the strict JSON schema `LINT_SCHEMAS` (`{verdict, reason}`) as structured output. Live, the request goes through the runner's seeded chat-completions call (`liveJudgeCall`, which now sends a system prompt), so ADR 0017's seed rule holds.
- A reply is read as one JSON object, alone or in one markdown fence, whose verdict (trimmed, any case) is one of the lint's two; an empty reply is a refusal (pi-ai 1.3.0's chat completions drop the provider's `refusal` field, leaving empty text); anything else is malformed. No reply is asked for again because of how it parses; the live call (`liveJudgeCall`) retries only a transient failure (429, 5xx or a network error), up to 3 attempts with the same request. Only a flag is a finding; refusals and malformed replies are returned in `LintReport.judgments` and append no event. On adversarial replies (review L3-6): extra fields are accepted; a flag embedded in prose is malformed; two JSON objects are malformed; with a duplicated `verdict` key the last one wins, as `JSON.parse` reads it; text after a code fence is malformed.
- An item's own content can steer the verdict, for example a claim that says it is stated verbatim in its source; the prompt tells the model the inputs are data, not instructions, which a model may not heed, so the model tier's precision is only as good as that instruction holds (review L3-6).
- A model finding is one `lint` event of card L1's shape (policy id `<policy>/lint/<lint id>`, evidence in the reason) that also carries the call's usage. Its evidence names the other item or the source, the recorded hash, the model and seed, and the model's reason, clipped to 280 characters; when the source is outside the linted scope the reason and the usage are withheld (the usage's input tokens would give the source's length; review L3-2), under ADR 0009's post-merge amendment. The usage stays in `LintReport.judgments` and the runner's `usage.json`.

## Alternatives considered

(a) Two tiers with the same interface: deterministic (expired validity, source changed, scope or class mismatch, missing provenance, orphan, duplicate) and model-based (contradiction, unsupported claim). (b) One model-based pass.

For the L3 amendment: every pair of a scope's items (quadratic, unaffordable at LongMemEval's scope sizes), or only a new write against its near-duplicates (cheap, misses dissimilar phrasings; `docs/readings/litreview/2403.08319-knowledge-conflicts-survey.md`); flagging both items of a contradiction (halves its precision when one side is the original); judging a claim against a changed source (double-counts source-changed); retrying a malformed reply (a retry with the same request is a cache hit, another request changes the protocol); recording a refusal as an `info` finding (counts noise as findings).

## Consequences

Unblocks L1, L3, L4, X10. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)

Amendment of 2026-11-21, recording answers given on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`), carried by the answers card; the lead may overturn any:

- Item 43: the bound behind the roadmap's risk "model-based lint variance above bound" is a standard deviation across seeds of at most 0.05 on precision and on recall, per lint, on card L3's pilot.
- Item 44: a later update of the same attribute counts as a contradiction. The contradiction prompt (`LINT_PROMPTS.contradiction`) is to be changed to say so, and its cassettes recorded again. Not done yet: the change also moves the prompt characters that `research/results/h3-lint-floor.json` and `research/results/h2-cost-table.json` record, so it is its own PR with those results regenerated (backlog).
- Item 47: H3's live model-lint run covers all 500 questions, as registered (95,217 calls).
- Card L3's proposed amendment above stays proposed; item 44 changes one of its requests once built.

Amendment of 2026-11-21, recording the lead's own answer of that day (`docs/tasks/lead-decisions.md`, item 58):

- If card L3's pilot shows a standard deviation across seeds above 0.05 on precision or recall for any lint, the deterministic tier becomes H3's primary test and the model tier is reported as secondary. The rule is registered before any pilot data.
