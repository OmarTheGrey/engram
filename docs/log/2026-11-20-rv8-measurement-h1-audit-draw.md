---
date: 2026-11-20
author: claude-agent
type: measurement
card: RV8
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-label-audit.json
  - "uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit.json --out research/results/h1-label-audit.json"
supersedes: none
---

**What.** H1's audit draw (GateMem and MEM-INV-Bench) recorded the same way, MANIFEST row research/results/h1-label-audit.json.

**Why.** The same script serves both configs, so H1's draw, unchanged by this card, is pinned beside LongMemEval's.

**Result.** GateMem 50, stop at 6 rejected; MEM-INV-Bench 38, stop at 4; no count per kind, since the members read this repository. Both sizes match the pre-registration's.

**Consequence.** A change to the sampler that moved H1's draw now fails `make test-repro`.
