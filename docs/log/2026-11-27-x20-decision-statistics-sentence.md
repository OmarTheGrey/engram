---
date: 2026-11-27
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - docs/tasks/X20.md
supersedes: none
---

**What.** The Statistics sentence "Two of these are not built yet: ... both are built before the tag (pre-tag condition 3)." now reads only "Both are built (pre-tag condition 3)."; the longer wording the fix pass had added is gone, and condition 3's clause is left in the lead's words.

**Why.** The orchestrator's decision on the final review's finding 1: card step 5 sanctions saying both are built, in the same words, and nothing more. The added list (overflow or moderation) closed the registered open wording "an error no retry can fix", which the lead's answer of 2026-11-26 did not cover.

**Result.** `git diff origin/main -- docs/research/preregistration.md` shows two hunks: condition 3, and this sentence's one change.

**Consequence.** The stop set is registered once, in condition 3.
