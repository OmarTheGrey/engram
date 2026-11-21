---
date: 2026-11-21
author: claude-agent
type: measurement
card: E2.9
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/secret-guard.json
  - research/configs/secret-guard.json
  - research/scripts/secret_guard.py
  - research/results/MANIFEST.md
  - "uv run python research/scripts/secret_guard.py --config research/configs/secret-guard.json --out research/results/secret-guard.json"
supersedes: none
---

**What.** The guard's coverage and false-positive rate, the MANIFEST row `research/results/secret-guard.json` (sha256 7a54d247..., commit pending).

**Why.** ADR 0039: each guard ships with a false-positive measurement on benign technical text, as a rule-9 result.

**Result.** Synthetic set, 24 kinds by 50: 1,200 of 1,200 found, at the expected tier and under an expected kind (Wilson low 0.9968). Benign: 14,587 paragraphs of 2,153 docs and source files at commit e4ea83e, with both guards in block: 0 denied, 6 held (0.041 percent, Wilson 0.019 to 0.090 percent). 900 generated identifiers (SHAs, UUIDs, uuidv7, content hashes, IAM actions, ARNs, integrity hashes, timestamps): 0 flagged. Reproduced through `reproduce.check_row`: no problems.

**Consequence.** The synthetic set is drawn in the rules' own shapes, so coverage is by construction; recall on secrets in the wild is card X14's.
