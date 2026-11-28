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

**What.** For the lead: card X16's unregistered audit row reproduced on this branch with a different sha256 (6afe298f... where MANIFEST held 8e61f235...).

**Why.** The guard lets only a row the card's plan entry names move, and E1.9's names none, so the change was reported before any regeneration.

**Result.** Every verdict was unchanged; only two `killed_by` messages differed, from the new `attestations` check and the version 2 genesis. Neither mutated line of chain.ts was changed.

**Consequence.** The orchestrator decided to regenerate the row in this PR (docs/log/2026-11-28-e1-9-measurement-gate-mutation-audit.md).
