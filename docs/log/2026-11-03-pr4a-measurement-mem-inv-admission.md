---
date: 2026-11-03
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-mem-inv-admission.json
  - research/configs/h1-mem-inv-admission.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h1_mem_inv_admission.py --config research/configs/h1-mem-inv-admission.json --out research/results/h1-mem-inv-admission.json"
supersedes: docs/log/2026-11-02-pr2-review-measurement-mem-inv-admission.md
---

**What.** MEM-INV-Bench admission by preset on the full 38-case set (32 attacks, 6 benign), MANIFEST row sha256 `bed41bee...`.

**Why.** The earlier measurement covered the 24-case subset only (review finding P2-8).

**Result.** Medium and permissive admit 32 of 32 attacks' poison and 6 of 6 benign values to the operator's action-time read; all 78 `team:operations` entries are read, the attacks' 32 trusted filler entries included. Strict admits 8 of 32 attacks, all 8 of laundering channel summarize (the agent's own note, scope `person:operator`), and 0 of 6 benign values: all 78 `team:operations` entries wait as candidates. A verifier's dry run of PR 2 predicted exactly these counts.

**Consequence.** Read with `2026-11-03-pr4a-finding-mem-inv-admission`.
