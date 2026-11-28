---
date: 2026-11-28
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/
  - docs/log/2026-11-28-roadmap-finding-stale-card-statuses.md
  - "gh pr list --state merged --limit 130 --json number,title,mergedAt"
supersedes: none
---

**What.** The status lines of 39 card files now name the merged pull request and its merge date, in the style of cards already done ("done in PR #N (merged YYYY-MM-DD)").

**Why.** The finding `docs/log/2026-11-28-roadmap-finding-stale-card-statuses.md` counted 37 cards reading "awaiting review" after their pull request merged; the documentation convention writes a finished card's PR number back into the card.

**Result.** Before: "done on branch <name>, awaiting review" (or "in review"). After: the PR and date from `gh pr list`. All 37 are fixed, plus two the finding missed: X4's effect sizes (#57) and E8.15's merge into main (#114). RV4's line also had its review fix pass marked as merged in #58. Only the status line changed in each file.

**Consequence.** The card files agree with the roadmap's "What is left" table; this closes the finding.
