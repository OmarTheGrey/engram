---
date: 2026-11-28
author: claude-agent
type: measurement
card: E1.7
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/h1-gate-mutation-audit.json
  - research/configs/gate-mutation-audit.json
  - research/scripts/gate_mutation_audit.py
  - research/results/MANIFEST.md
  - "uv run python research/scripts/gate_mutation_audit.py --config research/configs/gate-mutation-audit.json --out <temporary file>"
supersedes: none
---

**What.** Card X16's gate mutation audit rerun on the fixed code, with a clean tree.

**Why.** The card edits offboard.ts, write.ts and adopt.ts, which the frozen mutants name (docs/conventions/testing.md); no mutated line was edited, so no mutant's find or replace was rewritten, and the rerun shows the kills unchanged.

**Result.** sha256 8e61f235b5dc2d7af647b27ecbe92b13b5db4769448438452f662ec20b873e05, the MANIFEST row's; the frozen-mutant tests (`pytest research/tests -k mutant`) pass, 3 of 3.

**Consequence.** The row stays as it is.
