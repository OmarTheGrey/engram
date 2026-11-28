---
date: 2026-11-28
author: claude-agent
type: measurement
card: E2.21
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/results/h1-gatemem-reach.json
  - research/scripts/reproduce.py
supersedes: none
---

**What.** The guard's reruns: MANIFEST rows that reach the write gate, each through `reproduce.rerun_row`, one at a time.

**Why.** Part 2 edits `evaluate.ts`, `grants.ts` and `promotion.ts`; with the option absent every registered row must keep its bytes.

**Result.** Unchanged: `h1-gatemem-reach.json` (9607555c...), `h1-mem-inv-admission.json` (bed41bee...), `h1-injection-screen.json` (3e35dd39...), `h1-secret-guard.json` (ea5b7561...), `h1-leakage.json` (bc5c43f6...), `h1-quint-trace-replay.json` (c80cce59...). `h1-gate-mutation-audit.json` moved, unregistered (its own entry). Left to the orchestrator's one `make test-repro` on main, on its instruction of 2026-11-28 (the machine overloaded): every other row, `h2-frontier-axes` and the LongMemEval rows included. No preset or research config sets the option (`load-options.test.ts`).

**Consequence.** The final run must show the same.
