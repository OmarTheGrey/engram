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
supersedes: none
---

**What.** The gate mutation audit ran its 34 frozen mutants against the ten invariant tests on main's code (b207dbc4), one worker, in 5 minutes 48 seconds; its MANIFEST row is `research/results/h1-gate-mutation-audit.json`.

**Why.** Card X16: a regenerated number per invariant that the invariants bite. It is a proof of concept on the code's own property tests, no model involved, never a hypothesis result.

**Result.** 29 of 34 killed (kill rate 0.852941). Per invariant, killed of mutants: I1 4 of 5, I1H 1 of 3, I2 7 of 8, I3 2 of 2, I4 2 of 2, I5 5 of 5, I6 2 of 2, I7 2 of 2, I8 3 of 3, I9 1 of 2. Every invariant has a kill. Survivors: `I1-status-ignored`, `I1H-erase-active-only`, `I1H-store-delete-skipped`, `I2-untrusted-confirms`, `I9-link-ignores-previous`.

**Consequence.** The survivors are a finding; the result is listed under no hypothesis in the results register.
