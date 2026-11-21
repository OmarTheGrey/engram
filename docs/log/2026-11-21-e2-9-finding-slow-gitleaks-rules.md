---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.9
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/vendor/gitleaks-rules.ts
supersedes: none
---

**What.** Five gitleaks rules are left out for the backtracking bound: cisco-meraki-api-key, cohere-api-token, okta-access-token, privateai-api-token and sumologic-access-id.

**Why.** Each starts with a doubled lazy prefix, `[\w.-]{0,50}?(?i:[\w.-]{0,50}?(?:keyword)...`, harmless in RE2 and about 50 times slower in a backtracking engine.

**Result.** Linear, not exponential: 2,048 to 8,192 characters took 100 to 225 ms and 417 to 839 ms. The secrets they name go unrecognised except by the generic and heuristic rules.

**Consequence.** Rewriting the doubled prefix to one would admit them; that is a hand edit of generated data, so it is left for a later card.
