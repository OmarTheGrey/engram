---
date: 2026-11-21
author: claude-agent
type: measurement
card: E2.9
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-secret-guard.json
  - research/configs/secret-guard.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/secret_guard.py --config research/configs/secret-guard.json --out research/results/h1-secret-guard.json"
supersedes: docs/log/2026-11-21-e2-9-measurement-secret-guard.md
---

**What.** The guard's coverage and false-positive rate after the review fix pass, MANIFEST row `research/results/h1-secret-guard.json` (sha256 a59656af..., commit 697f2b9), renamed with an `h1-` prefix for the results glob and `"hypothesis": "none"`.

**Why.** The fixes moved the rules; the result also had to state its limits (E2.9-5).

**Result.** Synthetic: 1,200 of 1,200 found at the expected tier, by construction. Benign: 0 of 14,587 paragraphs denied, 4 held (0.027 percent, Wilson 0.011 to 0.071). Identifiers: 0 of 900. In-sample: the gates were tuned on this corpus. Nine limits listed. `check_row`: no problems.

**Consequence.** Out-of-sample rates are card X14's.
