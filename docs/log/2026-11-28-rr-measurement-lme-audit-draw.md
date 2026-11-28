---
date: 2026-11-28
author: claude-agent
type: measurement
card: none
chapter: results
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-label-audit-longmemeval.json
  - research/configs/label-audit-longmemeval.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit-longmemeval.json --out research/results/h2-label-audit-longmemeval.json"
supersedes: docs/log/2026-11-26-r5-measurement-lme-audit-draw.md
---

**What.** LongMemEval's label-audit draw record, a pre-registration support artefact, restated with its config as its own evidence item.

**Why.** The superseded entry named the config only inside its command, so the thesis consolidator rejects it; its facts still hold.

**Result.** The draw holds 50 questions (`benchmarks.longmemeval.items`) and stops at 6 rejected (`benchmarks.longmemeval.stop_at_rejected`), with a reject quorum of 2 (`reject_quorum`) among 3 members, stop share 0.1 (`stop_share`), seed 20261103 (`seed`) and `on_stop` `drop`. Its draw hash is `55ac6fe6754b053fabc9bb9b780ab271e9134d376c7ff4bf094f4be2f027e505` (`benchmarks.longmemeval.draw_sha256`), and the file hashes to the MANIFEST's 509268baf31ca7c2d8088f42b9c10ea5bac285a3fd3e6e720cba894390a3722e. No audit has been read yet, so no disagreement rate exists.

**Consequence.** Nothing changes in the draw; `make test-repro` checks the same hash.
