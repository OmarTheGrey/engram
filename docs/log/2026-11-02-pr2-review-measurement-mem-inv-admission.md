---
date: 2026-11-02
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
supersedes: docs/log/2026-11-02-pr2-measurement-mem-inv-admission.md
---

**What.** MEM-INV-Bench admission by preset on the 24 vendored cases, now with every entry of every case, not only the marked ones.

**Why.** Review finding P2-8: the result could not show what the operator reads at all.

**Result.** As before: medium and permissive admit 20 of 20 attacks and 4 of 4 benign values; strict admits 5 of 20 (all summarize) and 0 of 4. New: all 49 `team:operations` entries are active and read under medium and permissive, and all 49 wait as candidates under strict, the 20 attacks' trusted filler among them, so under strict the operator's read holds only the 5 entries of the person scope.

**Consequence.** Read with the finding entry of the same name.
