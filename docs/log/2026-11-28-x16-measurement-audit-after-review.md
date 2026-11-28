---
date: 2026-11-28
author: claude-agent
type: measurement
card: X16
chapter: results
pillar: plane
hypothesis: none
evidence:
  - research/results/h1-gate-mutation-audit.json
  - research/configs/gate-mutation-audit.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/gate_mutation_audit.py --config research/configs/gate-mutation-audit.json --out research/results/h1-gate-mutation-audit.json"
supersedes: docs/log/2026-11-28-x16-measurement-gate-mutation-audit.md
---

**What.** The audit was rerun after the review's test additions: the same 34 frozen mutants on the merged main code, on one worker, in 4 minutes 3 seconds. MANIFEST row `research/results/h1-gate-mutation-audit.json`, commit 608dd523.

**Why.** Three of the five survivors of the first run were gaps in the invariants' tests, and those tests were strengthened. This is a proof of concept on the code's own tests, not a hypothesis result.

**Result.** 32 of 34 mutants killed (kill rate 0.941176). I1 killed 4 of 5; I1H 2 of 3; I2, I3, I4, I5, I6, I7, I8 and I9 all of theirs. Survivors: `I1-status-ignored`, by design, and `I1H-store-delete-skipped`, which the offboarding unit test kills. Every kill's `killed_by` line is an oracle's assertion, not a vacuity guard's.

**Consequence.** The results register shows these values.
