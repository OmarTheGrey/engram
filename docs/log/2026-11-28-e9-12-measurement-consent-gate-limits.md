---
date: 2026-11-28
author: claude-agent
type: measurement
card: E9.12
chapter: results
pillar: twin
hypothesis: none
evidence:
  - research/results/h1-consent-gate.json
  - research/configs/consent-gate.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/consent_gate.py --config research/configs/consent-gate.json --out research/results/h1-consent-gate.json"
supersedes: docs/log/2026-11-28-e9-12-measurement-consent-gate.md
---

**What.** The consent gate counted on a fixture workload again, after the review fix pass: a proof of concept on fixtures with no model, never a hypothesis result.

**Why.** The review asked for the matching evasions and the Incognito and distillation limits in the result's limits; the fix to which writes are judged reaches no write of this workload.

**Result.** Counts unchanged: 15 writes; 15 allowed under the twin profile; with three opt-outs 8 allowed, 7 refused under engram/write/consent (opt_outs[0] 3, [1] 3, [2] 1), 7 naming their opt-out, 0 repeating content. Only `limits` changed. sha256 3b0a06f43051c2594424e348d503a8764b8ec31d2023e70c6e87b5896d48ec14, MANIFEST commit 5efb38da.

**Consequence.** The register and the results page cite the new bytes.
