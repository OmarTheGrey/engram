---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.11
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/scripts/reproduce.py
  - "make test-one T=packages/core/test/unit/policy/trust-registered.test.ts"
supersedes: none
---

**What.** With the card merged with main at 5dd48f7c, every `h1-` and `h3-` row of `research/results/MANIFEST.md` regenerates with its recorded sha256.

**Why.** The card's acceptance asks that `make test-repro` be unchanged for those rows, and ADR 0040, decision 8, asks for a report if a confirmed gap could move a registered number.

**Result.** 13 of 13 rows reproduce, each rerun by `reproduce.py`'s `check_row` (a driver that selects the `h1-` and `h3-` rows): h1-gatemem-reach, h1-mem-inv-admission, h1-c4-verdict-agreement, h1-c4-walk, h1-cost, h1-refusal-leaks, h3-fault-set, h3-lint-floor, h1-check-runs-cost, h1-label-audit, h1-crosswalk, h1-injection-screen, h1-secret-guard. The registered presets' six decision digests are unchanged too.

**Consequence.** No registered number moves, so no report to the lead is needed under decision 8.
