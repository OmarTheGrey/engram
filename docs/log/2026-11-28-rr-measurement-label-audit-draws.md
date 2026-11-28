---
date: 2026-11-28
author: claude-agent
type: measurement
card: none
chapter: results
pillar: research
hypothesis: H2
evidence:
  - research/results/h1-label-audit.json
  - research/configs/label-audit.json
  - research/results/h2-label-audit-longmemeval.json
  - research/configs/label-audit-longmemeval.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit.json --out research/results/h1-label-audit.json"
  - "uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit-longmemeval.json --out research/results/h2-label-audit-longmemeval.json"
supersedes: docs/log/2026-11-21-rv8-review-measurement-audit-draws-without-counts.md
---

**What.** Both label audit draw records, MANIFEST rows `research/results/h1-label-audit.json` and `research/results/h2-label-audit-longmemeval.json`, restated as they stand after card R5.

**Why.** The earlier entry named neither config as evidence, gave one pair of stop counts for two draws, and predates R5's `on_stop` change.

**Result.** Pre-registration support artefacts: which items the members audit, not a hypothesis result. Neither file carries `by_kind`. H1's draw: GateMem `benchmarks.gatemem.items` 50, `stop_at_rejected` 6; MEM-INV-Bench `benchmarks.mem-inv-bench.items` 38, `stop_at_rejected` 4; `hypothesis` H1. LongMemEval's draw: `benchmarks.longmemeval.items` 50, `stop_at_rejected` 6; `hypothesis` "H2, H3". Both: `seed` 20261103, `reject_quorum` 2, `stop_share` 0.1, `on_stop` "drop".

**Consequence.** A changed draw still fails `make test-repro`.
