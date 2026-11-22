---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.9
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/bypass.ts
  - packages/core/src/policy/secrets.ts
supersedes: none
---

**What.** The bypass redactor (ADR 0014, R7-9) keeps vendor keys shorter than 32 characters in a bypass event's reason when no secret name or flag stands before them.

**Why.** Its last rule takes any run of 32 or more key characters; an AWS key id is 20, a Slack or GitLab token can be shorter, and `mem0 add AKIA...` keeps the id.

**Result.** Found while moving its patterns into the shared table; behaviour left unchanged by decision (bypass unchanged). Applying the guard's BLOCK-tier vendor rules in `bypassAttempt` would close it.

**Consequence.** For the lead: a small follow-up card, after the H1 live runs, since a bypass reason can reach a prompt.
