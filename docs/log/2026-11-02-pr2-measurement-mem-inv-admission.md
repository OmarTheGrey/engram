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
supersedes: none
---

**What.** The plane's admission of MEM-INV-Bench's poison under strict, medium and permissive, on the 24 vendored cases (commit `cf3c9a4`, every line matching the manifest), with no model.

**Why.** Plan PR 2, item 3; the evidence for the poisoning arm's preset in PR 4.

**Result.** Medium and permissive: all 20 attacks' poison is written active and reaches the operator's action-time read (5 of 5 for direct, summarize, tool_echo and corroborate), and all 4 benign cases' values. Strict: 5 of 20 attacks reach the read, all of them summarize (the agent's own note, model content kept in the person scope); the 15 others are written to the team scope as candidates awaiting review; none of the 4 benign cases' values reaches the read. Of the 34 marked entries, none was denied under any preset; under strict 29 wait as candidates.

**Consequence.** Read with the finding entry of the same day.
