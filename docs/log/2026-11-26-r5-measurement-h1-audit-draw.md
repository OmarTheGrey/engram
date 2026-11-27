---
date: 2026-11-26
author: claude-agent
type: measurement
card: R5
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-label-audit.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit.json --out research/results/h1-label-audit.json"
supersedes: docs/log/2026-11-20-rv8-measurement-h1-audit-draw.md
---

**What.** H1's audit draw record regenerated under `on_stop` `drop`, MANIFEST row research/results/h1-label-audit.json.

**Why.** The draw script copies `on_stop` beside the draw, so card R5's config change moves this result, the exception the pre-registration sanctions.

**Result.** `git diff` shows one line: `"on_stop": "pause"` to `"drop"`. New sha256 5d295d27d161e50c3f5374e7440e47e08be1c107a7b26bd2f9aca429ac36d223; the new file with that one value set back to `pause` hashes to 8d69b4e5a5871432ba0009bb560fd237606c743b73faadb41b16c55c1382b926, the old row's hash, so no item, id, order or stop moved. GateMem 50, stop at 6; MEM-INV-Bench 38, stop at 4, as before.

**Consequence.** `make test-repro` checks the new hash.
