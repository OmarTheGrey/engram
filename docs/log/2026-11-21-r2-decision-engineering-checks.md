---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/tasks/X14.md
  - docs/tasks/E2.10.md
supersedes: none
---

**What.** A card that builds an arm may run the arm's model-free part in full as its acceptance and commit the result. That result is an engineering check: it enters no registered analysis until the lead registers the arm.

**Why.** Cards X14, E2.10, L5 and L7 each produce a result file as acceptance, which is a full run of a model-free arm. Without the rule, a merged card's table could be cited as the arm's result before the arm was registered.

**Result.** The section's rules state it. On registration, the lead names the committed result the arm reads, or has it run again.

**Consequence.** The thesis cites these results as checks of a card until registration.
