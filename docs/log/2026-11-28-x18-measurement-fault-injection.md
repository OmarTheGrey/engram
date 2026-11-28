---
date: 2026-11-28
author: claude-agent
type: measurement
card: X18
chapter: results
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-fault-injection.json
  - research/configs/h3-fault-injection.json
  - research/results/MANIFEST.md
  - uv run python research/scripts/h3_fault_injection.py --config research/configs/h3-fault-injection.json --out research/results/h3-fault-injection.json
supersedes: none
---

**What.** Card X18's paired fault-injection check (proposal U6, unregistered) on LongMemEval's 500 bases of the pinned S split: 3,000 pairs, 2,970 targeted (five bases read nothing at medium). MANIFEST row `research/results/h3-fault-injection.json`, sha256 `9b6a7c2f...44f4`, commit 9fce0ec3.

**Why.** H3's recovery claim as a paired, model-free number. A proof of concept on scripted, model-free states supporting H3, never H3's test.

**Result.** Deletion and supersession change the read in every targeted pair (990 of 1,485 per place, 0.667); missing metadata in none. Projection faults: recovery by replay 990 of 990 (Wilson low 0.996), by construction. Log faults: recovery after the deterministic lints 0 of 990; `engram log verify` detects 1,485 of 1,485; a lint detects 495 (missing metadata only). Controls: 500 of 500 read as clean, none fails verification.

**Consequence.** The register shows it as proof of concept; U6 stays unregistered.
