---
date: 2026-11-21
author: claude-agent
type: milestone
card: L5
chapter: evaluation
pillar: research
hypothesis: H3
evidence:
  - packages/core/test/unit/lint/near-duplicate-presets.test.ts
  - research/results/MANIFEST.md
  - "make test-one T=packages/core/test/unit/lint/near-duplicate-presets.test.ts"
supersedes: none
---

**What.** Every registered preset's whole lint report and its `duplicate` findings, over the fault catalogue and card L2's fixture-size base, are pinned to their sha256 on main at 0e15f8b8, and `make test-repro`'s rows that lint were rerun one by one.

**Why.** The pre-registration guard: the tier must move nothing a registered condition does.

**Result.** The presets test passes before and after the tier (7 tests). `research/scripts/reproduce.py`'s `check_row` reproduces h3-fault-set (a274701d) and h3-lint-floor (354da571, card L4's row): "2 of 2 rows reproduce". The bench fault set's lint list was already frozen by card E2.10 (`FAULT_SET_LINT_IDS`), so the new id never reaches it. Command: check_row of research/scripts/reproduce.py on those two rows.

**Consequence.** Nothing registered changes.
