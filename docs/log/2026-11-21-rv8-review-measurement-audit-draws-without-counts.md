---
date: 2026-11-21
author: claude-agent
type: measurement
card: RV8
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - research/results/h1-label-audit.json
  - research/results/h2-label-audit-longmemeval.json
  - "uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit-longmemeval.json --out research/results/h2-label-audit-longmemeval.json"
supersedes: docs/log/2026-11-20-rv8-measurement-lme-audit-draw.md
---

**What.** Both audit draws regenerated without `by_kind`; MANIFEST rows research/results/h1-label-audit.json and research/results/h2-label-audit-longmemeval.json.

**Why.** Review finding RV8-6.

**Result.** Items, context hashes, `draw_sha256` and the stop counts (6 of 50, 4 of 38) are unchanged; only the count per kind is gone.

**Consequence.** A changed draw still fails `make test-repro`.
