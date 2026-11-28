---
date: 2026-11-28
author: claude-agent
type: finding
card: X18
chapter: evaluation
pillar: research
hypothesis: H3
evidence:
  - research/results/MANIFEST.md
  - uv run python research/scripts/h3_fault_set.py --config research/configs/h3-fault-set.json --out <tmp>
  - uv run python research/scripts/h3_lint_floor.py --config research/configs/h3-lint-floor.json --out <tmp>
supersedes: none
---

**What.** Card X18's guard: the registered H3 rows its check sits beside were rerun from this branch, and the new row was rerun once more.

**Why.** The check reads B5's write phase and the pinned S split that `h3-fault-set.json` and `h3-lint-floor.json` read; the card may move neither. Its changes are new files only, so no registered row, B5 fixture or cassette can be reached, and the reruns show it.

**Result.** `h3-fault-set.json` reran to `a274701d...199a` and `h3-lint-floor.json` to `354da571...25a9`, both their MANIFEST sha256; `h3-fault-injection.json` reran to `9b6a7c2f...44f4`, its own row, with 8 workers each time. `git diff origin/main` touches no fixture, cassette or registered config.

**Consequence.** Nothing registered moved.
