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

**What.** The replay's without-arm is the validation half's C1 sessions at seeds 1 to 3, run once and shared by every candidate.

**Why.** A replay session without a candidate is a C1 session, so running it again per candidate would repeat identical cached work.

**Result.** 156 sessions in place of 15 more per candidate; the registered threshold of ADR 0046 is unchanged. Proposed, card H5P item 6.

**Consequence.** The lead approves, changes or refuses it; nothing is registered until then.
