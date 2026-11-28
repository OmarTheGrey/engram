---
date: 2026-11-28
author: claude-agent
type: finding
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/
  - "gh pr list --state merged --limit 130 --json number,title,mergedAt"
supersedes: docs/log/2026-11-28-roadmap-finding-stale-card-statuses.md
---

**What.** Thirty-seven card files said "done on branch ..., awaiting review" although their pull request had merged.

**Why.** Found while deriving the roadmap's "What is left" table from the card files and the merged pull requests.

**Result.** They are B6 (#51), D2 (#98), D3 (#99), E1.6 (#102), E2.6 (#50), E2.11 to E2.13 (#93, #92, #97), E2.21 part 1 (#126), E8.11 to E8.14 (#91, #94, #95, #101), E9.4 (#44), E9.5's kit (#48), E9.8 (#104), E9.9 (#125), H5P (#121), L5 to L8 (#105, #103, #109, #124), R5 (#118), R6 (#120), RD1 (#127), RV1 to RV8 (#55, #53, #54, #58, #59, #60, #61, #65), X14 (#107), X20 (#122), X21 (#117) and ANS-2026-11-25 (#113). The documentation convention asks that a finished card's PR number be written back into the card.

**Consequence.** Done in the same pull request (`docs/log/2026-11-28-roadmap-change-card-statuses.md`).
