---
date: 2026-11-28
author: claude-agent
type: change
card: X16
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/gate_mutation_audit.py
  - research/tests/test_gate_mutation_audit.py
  - docs/conventions/testing.md
supersedes: none
---

**What.** The audit's dirty check now covers every tracked file the copy takes: everything but `docs/` and `research/`, including the root configs and fixtures. Each killed mutant records the first line of its first failed assertion as `killed_by`, with the copy's path removed. The docstring gives the real run time and says that ignored paths are outside the status guard. The pytest reads source bytes as the audit does. `docs/conventions/testing.md` gains a section that names the nine files the mutants target and what an edit to one of them owes.

**Why.** These are review findings 3, 5, 6, 7 and 8. Before this change, a kill by a vacuity guard could not be told apart from a kill by the oracle.

**Result.** 21 pytest cases pass, ruff and mypy are clean.

**Consequence.** Cards that edit those files see the coupling in the convention, not only in a log entry.
