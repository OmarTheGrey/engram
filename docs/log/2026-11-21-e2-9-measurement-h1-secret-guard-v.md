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
supersedes: docs/log/2026-11-21-e2-9-measurement-h1-secret-guard.md
---

**What.** The result after the verification pass, MANIFEST row `research/results/h1-secret-guard.json` (sha256 ea5b7561..., commit 97afa30).

**Why.** A new rule (63 hand rules now) and four new limits moved the bytes.

**Result.** Synthetic: 1,200 of 1,200 at the expected tier, by construction. Benign: 0 of 14,587 paragraphs denied, 4 held (0.027 percent, Wilson 0.011 to 0.071), in-sample. Identifiers: 0 of 900. Thirteen limits listed, the four new ones: a far or weak credential word, a 40-hex value read as a git SHA, keys ending EXAMPLE, a trailer-shaped address. `check_row`: no problems.

**Consequence.** Out-of-sample rates are card X14's.
