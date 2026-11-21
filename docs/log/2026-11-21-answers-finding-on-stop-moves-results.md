---
date: 2026-11-21
author: claude-agent
type: finding
card: none
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/label-audit.json
  - research/configs/label-audit-longmemeval.json
  - research/results/h1-label-audit.json
  - research/results/h2-label-audit-longmemeval.json
  - research/scripts/label_audit_draw.py
supersedes: none
---

**What.** Setting `on_stop` to `drop` in the two audit configs, as lead-decisions item 6 answers, would change two committed results.

**Why.** Card RV8 made the response a config value and said answering 6a is one value with nothing else moving (`docs/log/2026-11-20-rv8-decision-on-stop-pause.md`); `label_audit_draw.py` copies `on_stop` into each draw record beside the draw.

**Result.** `research/results/h1-label-audit.json` and `research/results/h2-label-audit-longmemeval.json` both hold `"on_stop": "pause"`, so their sha256 would change, though no draw hash would. The answers card did not change the configs, as its brief forbids moving a committed result.

**Consequence.** One small PR sets `drop` in both configs and regenerates the two records with their MANIFEST rows, before the agreement of the audit of 23 to 28 November is computed. Until then v1 and the procedure say the configs still read `pause`.
