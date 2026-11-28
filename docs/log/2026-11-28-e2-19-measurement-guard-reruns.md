---
date: 2026-11-28
author: claude-agent
type: measurement
card: E2.19
chapter: evaluation
pillar: govern
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/results/h1-gate-mutation-audit.json
  - research/results/h2-cedar-properties.json
  - research/results/h3-fault-injection.json
  - "uv run python research/scripts/<name>.py --config <config> --out <file>, per row"
supersedes: none
---

**What.** Every MANIFEST row whose script runs the TypeScript plane was rerun alone from its config and its sha256 compared with the manifest's: 23 rows, among them the gate mutation audit (`8e61f235...`), the Cedar properties (`9e6d4084...`) and the fault injection (`6bfb6faa...`).

**Why.** The guard: no registered or unregistered row may move. The card changes the evaluator, the promote path, the oracle, the loader and the Cedar export, all reached only when a policy sets `approval`, which no preset or config does.

**Result.** All 23 identical. `h2-frontier-axes.json` was not rerun: about two hours, and no registered config promotes or sets the block. Fault injection ran out of memory twice under load, then matched alone with one worker.

**Consequence.** No row's hash or commit changes.
