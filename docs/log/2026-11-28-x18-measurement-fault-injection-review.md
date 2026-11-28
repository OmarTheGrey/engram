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
supersedes: docs/log/2026-11-28-x18-measurement-fault-injection.md
---

**What.** Card X18's result regenerated after its review: deletion is now detected through an orphan naming the deleted id, and the limits state what each column is fixed by and verification's threat model. MANIFEST sha256 `6bfb6faa...9368`, commit a9406939.

**Why.** Rule 9. A proof of concept supporting H3 on the pinned S split, model-free, measuring state recovery rather than H3's utility recovery; never H3's test.

**Result.** Counts unchanged: 2,970 of 3,000 pairs targeted (five bases read nothing at medium; why was not examined). Deletion and supersession change the read in 495 of 495 per place, missing metadata in 0. Replay recovers 990 of 990 projection faults, by construction; the lints recover 0 of 990 log faults. A lint detects missing metadata only (495 per place). Verification catches 1,485 of 1,485 edits that do not re-chain and fails no control.

**Consequence.** Register regenerated.
