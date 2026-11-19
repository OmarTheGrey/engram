---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - research/scripts/l3_variance.py
  - research/tests/test_l3_variance.py
supersedes: none
---

**What.** Review finding L3-1: research/scripts/l3_variance.py wrote a scripted model's variance into research/results/ without complaint.

**Why.** Nothing in the script tied its output path to whether the run was scripted, and rule 9 reserves research/results for results.

**Result.** Reproduced by the reviewer with `--out research/results/zz-l3-probe.json`, exit 0. Fixed: `main` refuses a scripted run whose resolved output is under research/results, before writing. The new pytest fails when the check is disabled.

**Consequence.** A scripted variance can only land outside research/results, as `make l3-variance FIXTURE=1` already writes it to .engram/.
