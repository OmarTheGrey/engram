---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/log/2026-11-03-orch-manifest-commit-after-squash.md
  - research/results/MANIFEST.md
supersedes: none
---

**What.** Recommended, for the lead's decision: accept the orchestrator's rule that a MANIFEST row names the commit on main that holds its code, rewritten after a squash merge by the next PR (decision sheet item 17).

**Why.** The rule is the orchestrator's; it bears on which commits the tagged protocol's results cite.

**Result.** PR 4's rows name this branch's commits until its squash commit replaces them (`research/results/MANIFEST.md`).

**Consequence.** None for `make test-repro`, which does not read the column.
