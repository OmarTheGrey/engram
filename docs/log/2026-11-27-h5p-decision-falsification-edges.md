---
date: 2026-11-27
author: claude-agent
type: decision
card: H5P
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/H5P.md
supersedes: none
---

**What.** If the induction yields no candidate in either domain, H5 does not run and enters Holm with p = 1; if the replay admits none, C5 is C1 and the report says so.

**Why.** Both edges are fixed before any data (lead-decisions item 8), so no outcome is chosen after the induction is seen.

**Result.** A positive C5 minus C1 with a C5 minus C2 interval at or below zero does not support H5. Proposed, card H5P item 16.

**Consequence.** The lead approves, changes or refuses it; nothing is registered until then.
