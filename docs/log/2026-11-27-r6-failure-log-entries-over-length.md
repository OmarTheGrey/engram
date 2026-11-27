---
date: 2026-11-27
author: claude-agent
type: failure
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-27-r6-change-require-parameters.md
  - docs/log/2026-11-27-r6-finding-listing-reread.md
  - docs/log/2026-11-27-r6-finding-upstream-name-blind-to-tags.md
  - "make lint-docs"
supersedes: none
---

**What.** `make lint-docs` failed on three of the fix pass's entries, each over the 150-word limit for a body (159, 152 and 171 words).

**Why.** They were written as complete entries and never counted.

**Result.** Each was shortened on this branch before merge, with no fact dropped but the service tiers the listing gives OpenAI's endpoints. `make lint-docs` passes.

**Consequence.** None outside this branch.
