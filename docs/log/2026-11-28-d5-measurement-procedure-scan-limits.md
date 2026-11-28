---
date: 2026-11-28
author: claude-agent
type: measurement
card: D5
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h5-procedure-scan.json
  - research/configs/procedure-scan.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/procedure_scan.py --config research/configs/procedure-scan.json --out research/results/h5-procedure-scan.json"
supersedes: docs/log/2026-11-28-d5-measurement-procedure-scan.md
---

**What.** The unregistered `research/results/h5-procedure-scan.json` moved after its review: its limits name the known evasions (homoglyphs, fullwidth forms, shell quoting, variables, `find -delete`, look-alike slashes) and that hidden characters are the gate's.

**Why.** The review (finding 5). A proof of concept on fixtures, never a hypothesis result.

**Result.** Counts unchanged: under hold 39 of 39 unsafe cases held, 3 of 45 controls held (the hard negatives); off and report admit all 84. The bounded rule and the release rule move no case. New sha256 `0ac5428238ea46f52fbd3d152f649f370935ebef2bee4a7ba95fb03e296cc39f`, MANIFEST commit 69cea16c.

**Consequence.** The register and the results page are regenerated.
