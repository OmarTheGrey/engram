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

**What.** Proposed for the lead: the validation half's C1 sessions at seeds 1 to 3 as the replay's without-arm, run once and shared by every candidate.

**Why.** A replay session without a candidate is a C1 session, so running it again per candidate would repeat identical cached work.

**Result.** 156 sessions in place of 15 more per candidate; the registered threshold of ADR 0046 is unchanged. Card H5P row 6.

**Consequence.** The lead's answer entry on this item supersedes this one; nothing is registered until then.
