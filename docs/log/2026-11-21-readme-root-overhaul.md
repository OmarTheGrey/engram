---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - README.md
  - docs/research/positioning.md
  - research/results/h2-cost-table.json
  - "make lint-docs"
supersedes: none
---

**What.** The root `README.md` was rewritten for four readers (a newcomer, a team member, an examiner, a possible adopter), keeping the brand banner.

**Why.** The lead asked for READMEs that describe the project in full, its state, its usage and its next steps; the old one still said "Pre-week-zero".

**Result.** Sections: what Engram is (the five mechanisms and the three products), why it exists (the claim exactly as `docs/research/positioning.md` states it, with its limits and withdrawals), a layer diagram, the status of 2026-11-21 with known limits, a quick start whose write, read, explain, deny and serve steps were run on a temporary folder, grouped commands, the research programme (H1 to H5, C1 to C7, benchmarks, models), a repository map, contributing, what is next, licence and links. The cost figure cites `research/results/h2-cost-table.json`.

**Consequence.** The status section must be refreshed when E2.9, E2.10 and X15 merge and at each gate.
