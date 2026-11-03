---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
supersedes: none
---

**What.** `main()` in `label_audit_agreement.py` reads `stop_share` from the config, but no test reached `main()`: a hardcoded 0.2 survived (F-2).

**Why.** The tests called `compare_dir` with the threshold and never ran the command the how-to gives.

**Result.** A CLI test runs `main()` on MEM-INV-Bench sheets under two configs (the committed 0.1, and 0.3) and checks that the output's `stop_share` is each config's. The mutant is killed.

**Consequence.** The command a member runs is tested, not only the function under it.
