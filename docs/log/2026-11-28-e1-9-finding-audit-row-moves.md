---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.9
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/h1-gate-mutation-audit.json
  - "uv run python research/scripts/gate_mutation_audit.py --config research/configs/gate-mutation-audit.json --out <tmp>"
supersedes: none
---

**What.** For the lead: on this branch card X16's unregistered audit row reproduces with a different sha256 (6afe298f... where MANIFEST holds 8e61f235...), so it was not regenerated.

**Why.** The guard lets only a row the card's plan entry names move, and E1.9's names none.

**Result.** Every mutant is killed or survives as before; only two `killed_by` messages differ: the I9 lint-evidence kill now lists the `attestations` check among the checks, and the I9 link kill quotes genesis hashes that differ because a new genesis says version 2. Neither mutated line of chain.ts was changed. All other rerun rows are unchanged.

**Consequence.** The orchestrator decides whether to regenerate the row, with a new sha256 and commit, in this PR or after it.
