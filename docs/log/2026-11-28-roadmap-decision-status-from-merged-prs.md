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
  - docs/log/2026-11-28-roadmap-finding-stale-card-statuses.md
supersedes: none
---

**What.** The "What is left" table takes a card's status from the merged pull requests, not from its card file's status line, and leaves the plan's tables and the card files unedited.

**Why.** The task cards' tables have no status column. Many card files still read "awaiting review" after their pull request merged. A merged pull request is the stronger record.

**Result.** "Not started" means no merged pull request. A card whose engineering merged but whose acceptance is a live run (B1, B5, B6, L3, R1, X4, E9.5) is listed as left. Cards whose week passed unmerged (E8.7 in W7, E0.6 and E0.7 in W8) are marked "planned W7" or "planned W8" and not moved; moving them is a planning call. B5 and B6 wait for X22, which the card requires before any live run after H1.

**Consequence.** Rewriting the stale status lines is a separate pull request.
