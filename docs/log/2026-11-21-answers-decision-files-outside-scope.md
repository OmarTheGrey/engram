---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - docs/dogfood.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** Documents the answers change but the card's brief did not list are left as they are and named in the backlog: `docs/dogfood.md`, `docs/tasks/prereg-v1-plan.md` section 7, the status lines of cards E9.5, X2 and X3, card B9, and `research/configs/h1-check-runs-cost.json`.

**Why.** The brief names the files the answers card may change; R1's answers card also edited cards and the v1 plan, but this brief's list is the narrower one, and the last moves a committed result.

**Result.** One backlog row lists them with what each still says.

**Consequence.** A housekeeping PR, or the orchestrator, updates them; the live commands in the v1 plan must name M1 before the smoke run.
