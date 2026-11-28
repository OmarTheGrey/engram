---
date: 2026-11-28
author: claude-agent
type: finding
card: X17
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/scripts/results_page.py
  - research/tests/test_results_page.py
  - Makefile
supersedes: none
---

**What.** Every card of the second plan that adds a MANIFEST row now also regenerates the results page, and a proof of concept needs a `title` in its register section.

**Why.** The page refuses a row without a register section, a proof of concept without a title and a hypothesis result without `cost` paths, and its test fails when the committed page is stale.

**Result.** Cards in flight that add proofs of concept (X18's fault injection, X19's residue check, E2.18's Cedar proofs) were briefed on the register, not the page; merged after X17, each fails `research/tests/test_results_page.py` until `make results-page` runs with a title added. An optional `meter` (part, whole, label, and `complement` for a zero count) draws its bar.

**Consequence.** The orchestrator runs `make results-page` after merging each such card, or tells its agent to; card X4 adds `cost` paths and the figure cell for H1's table.
