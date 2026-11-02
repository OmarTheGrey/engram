# ADR 0015: Evaluation protocol: six benchmarks, seven conditions, vendored judges, label audit

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

GateMem, MPBench, LongMemEval, MERIT, MemoryAgentBench and tau2-bench cover governance, poisoning, recall, action, competencies and tool use; Ground Truth First's six percent LoCoMo error rate; MERIT's and Kapoor's cost accounting; EvoMemBench's warning that long-context baselines stay competitive.

## Decision

Benchmark tasks run through the pi runner with the condition selecting the extension and policy; upstream judges are vendored at pinned commits and called over subprocess with JSON on stdin and stdout; a 50-item label audit per benchmark is done before any run and reported; a long-context no-memory baseline is a condition. Code availability for GateMem and MPBench is unverified as of this writing and is step 0's first check.

Amendments made when deciding:

- Amended from S0.6 (`packages/bench/PINS.md`): MPBench has no release, so a request to its authors is drafted and card BF1 reconstructs the probe format, with MEM-INV-Bench (2606.24322) as the alternative.
- tau2-bench is pinned to tag v1.0.1, not the moving head; GateMem's hidden scoring fields are stripped by the bench adapter; a no-memory condition (C1) runs on every benchmark.

Amendments made in the review fix pass, 2026-10-25 (PR #7, findings R7-1 to R7-15):

- Decision D13 (finding R7-5): C2, C3 and C5 present the same tool names, descriptions, parameters and write-result wording, from one definition in `@engram/pi-extension` (src/tools.ts) used by the extension and by the runner's ungoverned tools; a test asserts the declared tools are byte-identical across the three. Only C3's system prompt adds the policy text and only C5 routes through the Plane. What C5 adds is the mechanism: a denial reads as the Plane's reason, and what the Plane admits reaches the model inside the memory tag of ADR 0009, with its read id and rules. Counting the tag as mechanism rather than prompt is a choice the lead should confirm before any H1 or H2 run; the alternative is to render C2 and C3 reads in the same tag shape without policy attributes.

Amendments made in PR 6 (Gate A), 2026-10-29, on the plan's decision to settle the open question above (`docs/tasks/gate-a-e0-e1-e2-plan.md`, section 3):

- The memory tag is presentation, shared by every condition; the mechanism is admission. C2 and C3 render a read in the same `<engram:memory>` and `<engram:item>` shape as C5 (one renderer, `tagUngovernedRead` and `tagRecall` in `packages/pi-extension/src/tag.ts`): `filtered` on the read (always 0 in C2 and C3, which filter nothing), and per item its id, scope, rank and escaped content. Only C5's tag carries the read id and the rules: the read rule on `<engram:memory>` and the admitting rule on each `<engram:item>`. A test (`packages/runner/test/conditions.test.ts`, "a read reaches the model in one tag shape") asserts that the three conditions' rendered reads of the same items differ only in those attributes, item ids aside, which C5's plane draws from the shared id sequence. Why: conditions differ only in mechanism (decision D13); a tag only C5 wore was a presentation confound, and admission, not presentation, is what the claim is about (2610.11188).
- The score left the tag in every condition, C5 included. C2 and C3 have no score to show (the store's search returns an order, not a score), so keeping it in C5 alone would have been a second presentation difference. The score stays in each item's explanation (ADR 0009): in the read's details, in the log and through `engram explain`; in the product extension also through `memory_explain`. In the runner's conditions, which offer only `memory_read` and `memory_write`, the model sees the rank and no score. Cost if the lead reverses this: C5's tag gains `score` back, and C2 and C3 need a score from somewhere, which would make retrieval itself a shared component.
- C3's policy text is the loaded Policy object, the one C5 enforces, rendered as JSON with its keys sorted at every depth (array order kept, since rule order is content), not the preset's YAML file. Found by PR 4: with the file's text, comments included, rewording a preset comment changed C3's prompt and so its cassette keys. Now only the policy's content enters the prompt; tests assert that a preset differing only in comments, or only in key order, gives a byte-identical C3 prompt and that a content change does not (`packages/runner/test/conditions.test.ts`). The units the YAML stated only in comments (ttl in seconds, confidence between 0 and 1, budget in active items, and that lints.enabled does not turn lints on) are one fixed legend line before the JSON (`POLICY_LEGEND`, review finding P6-8), constant text, so it never moves the keys. Cost if wrong: the model reads the policy as JSON rather than as the commented YAML, losing the comments' explanations of each preset's stance; if the lead wants them, they belong in a field of the policy, where they are content.
- The RN1 probe's cassettes were re-recorded once for both changes (`make fixtures`), and the pi session fixture `fixtures/sessions/s0-interception.expected.json` changed by the dropped attribute only.

Amendments made by the Gate B plan, 2026-10-29 (`docs/tasks/gate-b-plan.md`, decision 3):

- The poisoning arm runs on MEM-INV-Bench, chosen and dated 2026-10-29 (ADR 0029), since MPBench has no release; it is registered when the pre-registration leaves the backlog.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks B1 to B9, X1. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `packages/bench/PINS.md`
- `docs/research/preregistration.md`
