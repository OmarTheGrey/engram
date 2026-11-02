# ADR 0012: Induction method: Agent Workflow Memory over pi session trees, reimplemented in TypeScript

Status: accepted, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

AWM (ICML 2025) is the simplest published method with strong results and a Python reference implementation; ReasoningBank shows failures carry signal; EvoMemBench catalogues alternatives. The roadmap's rule: govern a published method, do not invent one.

## Decision

(a), with the induction prompt vendored verbatim and cited. Abandoned branches and `branch_summary` entries are the failure signal. Strategies (ReasoningBank-style) are out of v1.

## Alternatives considered

(a) Reimplement AWM's induction prompt and workflow format in TypeScript over pi session JSONL, using abandoned branches as negative examples. (b) Call the Python reference over subprocess. (c) ReasoningBank.

## Consequences

Unblocks D2. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2409.07429-awm.md`
