---
date: 2026-11-19
author: claude-agent
type: finding
card: E9.5
chapter: evaluation
pillar: govern
hypothesis: none
evidence:
  - docs/roadmap.md
  - docs/tasks/E9.5.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Gate D asks that the Knowledge and Twin profiles run on dogfood data with zero recorded violations, but no card covers a Knowledge profile dogfood.

**Why.** Card E9.5 covers the Twin profile only; cards E9.1 and E9.3 built the Knowledge profile and its screens, and neither runs it on dogfood data.

**Result.** The roadmap's week 16 names only "dogfood violation report (must be zero)", which E9.5 provides for the twin.

**Consequence.** A backlog row for the lead: add a card for a Knowledge dogfood (the report runs under any policy with `--policy`), or read Gate D's criterion as the Twin profile's.
