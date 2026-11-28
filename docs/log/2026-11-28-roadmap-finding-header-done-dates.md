---
date: 2026-11-28
author: claude-agent
type: finding
card: none
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - "gh pr list --state merged --limit 130 --json number,title,mergedAt"
supersedes: none
---

**What.** The pre-registration header marks pre-tag conditions 2, 3 and 5 "Done on 2026-11-26", but R5 (#118), X20 (#122) and R6 (#120) merged on 2026-11-27 (UTC); only X21 (#117) merged on 2026-11-26.

**Why.** Found when the branch's review compared the roadmap's done dates with the card status lines.

**Result.** The header's dates match the cards' change entries of 2026-11-26 (`docs/log/2026-11-26-r5-change-on-stop-drop.md`, `docs/log/2026-11-26-x20-change-answer-refused.md`, `docs/log/2026-11-26-r6-change-endpoint-pins.md`), written on their branches before the merges. The roadmap now gives the merge dates and names the header's date beside them. The registered text is not edited.

**Consequence.** Whether the header's marks change before the tag is the lead's call, in the PR that writes the audit into v1.
