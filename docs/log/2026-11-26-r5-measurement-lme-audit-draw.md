---
date: 2026-11-26
author: claude-agent
type: measurement
card: R5
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-label-audit-longmemeval.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit-longmemeval.json --out research/results/h2-label-audit-longmemeval.json"
supersedes: docs/log/2026-11-20-rv8-measurement-lme-audit-draw.md
---

**What.** LongMemEval's audit draw record regenerated under `on_stop` `drop`, MANIFEST row research/results/h2-label-audit-longmemeval.json.

**Why.** The draw script copies `on_stop` beside the draw, so card R5's config change moves this result, the exception the pre-registration sanctions.

**Result.** `git diff` shows one line: `"on_stop": "pause"` to `"drop"`. New sha256 509268baf31ca7c2d8088f42b9c10ea5bac285a3fd3e6e720cba894390a3722e; the new file with that one value set back to `pause` hashes to 7bd9b9befb85ad96b4960cb093d78d8c8e69b51788f0020c2f813eb3049f096a, the old row's hash, so the 50 questions, their order and the stop are unchanged. The pinned S split was copied from another worktree and its sha256 checked by the script.

**Consequence.** `make test-repro` checks the new hash.
