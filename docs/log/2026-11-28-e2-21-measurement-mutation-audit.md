---
date: 2026-11-28
author: claude-agent
type: measurement
card: E2.21
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/h1-gate-mutation-audit.json
  - research/results/MANIFEST.md
  - uv run python research/scripts/gate_mutation_audit.py --config research/configs/gate-mutation-audit.json --out research/results/h1-gate-mutation-audit.json
supersedes: none
---

**What.** The gate mutation audit's row (card X16, a proof of concept, never a hypothesis result) rerun on this branch, as the testing convention asks when the invariants or the audited core files change.

**Why.** Part 2 edits `evaluate.ts`, `promotion.ts` and invariant 2; no frozen mutant's line changed (`test_every_frozen_mutant_still_applies_once_to_the_committed_code` passes), but invariant 2 now draws one more kind of write.

**Result.** 32 of 34 mutants killed, the same survivors as before (`I1-status-ignored`, `I1H-store-delete-skipped`), every verdict unchanged. The sha256 moves from `8e61f235...` to `6721f9e7...`: only the `killed_by` texts of four I2 mutants differ, the first counterexample fast-check finds under the new draw. The MANIFEST row names the commit that wrote it; the register and the results page are regenerated.

**Consequence.** No registered result moves; this row is unregistered.
