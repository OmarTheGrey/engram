---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/analysis/power.py
  - research/scripts/h4_power.py
supersedes: none
---

**What.** Where the TOST's level over the composite null exceeds alpha at a size, the size is dropped and the ladder climbs; the critical value is not calibrated.

**Why.** The review allowed either. A calibrated critical value depends on the size and the margin, so v1 would pre-register a different test with a lookup table; dropping keeps the test the pre-registration states and costs items, only at alpha 0.01.

**Result.** At alpha 0.01 the composite null sets 103 of 144 sizes, all at 320, 761 and 2,560 items (10, 5 and 2 points); at alpha 0.05 power sets all 144. Rejected for now: calibration. Cost if wrong: items a calibrated test would save.

**Consequence.** PR 4 chooses between these sizes at alpha 0.01 and a calibrated test.
