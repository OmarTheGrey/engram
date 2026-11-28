---
date: 2026-11-28
author: claude-agent
type: decision
card: X17
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/scripts/results_page.py
  - docs/research/preregistration.md
  - docs/research/results.html
supersedes: none
---

**What.** A row's cost is read from its file at `cost` key paths when given, else stated as "no model call: regenerated offline from committed inputs"; a hypothesis result without cost paths is refused. A row is marked exploratory when its pre-registration heading sits under "Proposed amendments, not yet registered".

**Why.** Every current row is regenerated offline by `make test-repro`, so its cost is no model call; a live result's calls and dollars live in its own file and must be read, not typed. Deriving exploratory from the pre-registration's structure means a proposed arm's number can never appear unmarked, the card's stated risk.

**Result.** The five rows of arms P1 to P4 (`h1-injection-screen`, `h1-secret-guard`, `h1-redteam`, `h3-near-duplicate`, `h3-lint-nli`) carry the exploratory badge on the page. Run times are not shown: they are not byte-stable.

**Consequence.** Card X4's H1 table must name `cost` paths when it adds its row.
