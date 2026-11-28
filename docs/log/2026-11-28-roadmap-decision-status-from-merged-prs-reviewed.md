---
date: 2026-11-28
author: claude-agent
type: decision
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/roadmap.md
  - "gh pr list --state merged --limit 130 --json number,title,mergedAt"
  - docs/log/2026-11-28-roadmap-change-card-statuses.md
supersedes: docs/log/2026-11-28-roadmap-decision-status-from-merged-prs.md
---

**What.** The "What is left" table takes a card's status from the merged pull requests, and the plan's task-card tables stay as they are.

**Why.** The task cards' tables have no status column. Many card files read "awaiting review" after their pull request merged. A merged pull request is the stronger record.

**Result.** "Not started" means no merged pull request. A card whose engineering merged but whose acceptance is a live run (B1, B5, B6, L3, R1, X4, E9.5) is listed as left. Cards whose week passed unmerged (E8.7 in W7, E0.6 and E0.7 in W8) are marked "planned W7" or "planned W8" and not moved; moving them is a planning call. B5 and B6 wait for X22, which the card requires before any live run after H1. Merge dates are UTC.

**Consequence.** The stale status lines were rewritten in the same pull request (`docs/log/2026-11-28-roadmap-change-card-statuses.md`).
