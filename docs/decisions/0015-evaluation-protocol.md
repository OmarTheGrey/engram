# ADR 0015: Evaluation protocol: six benchmarks, seven conditions, vendored judges, label audit

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

GateMem, MPBench, LongMemEval, MERIT, MemoryAgentBench and tau2-bench cover governance, poisoning, recall, action, competencies and tool use; Ground Truth First's six percent LoCoMo error rate; MERIT's and Kapoor's cost accounting; EvoMemBench's warning that long-context baselines stay competitive.

## Decision

Benchmark tasks run through the pi runner with the condition selecting the extension and policy; upstream judges are vendored at pinned commits and called over subprocess with JSON on stdin and stdout; a 50-item label audit per benchmark is done before any run and reported; a long-context no-memory baseline is a condition. Code availability for GateMem and MPBench is unverified as of this writing and is step 0's first check.

Amendments made when deciding:

- Amended from S0.6 (`packages/bench/PINS.md`): MPBench has no release, so a request to its authors is drafted and card BF1 reconstructs the probe format, with MEM-INV-Bench (2606.24322) as the alternative.
- tau2-bench is pinned to tag v1.0.1, not the moving head; GateMem's hidden scoring fields are stripped by the bench adapter; a no-memory condition (C1) runs on every benchmark.

Amendments made in the review fix pass, 2026-10-25 (PR #7, findings R7-1 to R7-15; pending the lead's review like the rest of this ADR):

- Decision D13 (finding R7-5): C2, C3 and C5 present the same tool names, descriptions, parameters and write-result wording, from one definition in `@engram/pi-extension` (src/tools.ts) used by the extension and by the runner's ungoverned tools; a test asserts the declared tools are byte-identical across the three. Only C3's system prompt adds the policy text and only C5 routes through the Plane. What C5 adds is the mechanism: a denial reads as the Plane's reason, and what the Plane admits reaches the model inside the memory tag of ADR 0009, with its read id and rules. Counting the tag as mechanism rather than prompt is a choice the lead should confirm before any H1 or H2 run; the alternative is to render C2 and C3 reads in the same tag shape without policy attributes.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks B1 to B9, X1. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `packages/bench/PINS.md`
- `docs/research/preregistration.md`
