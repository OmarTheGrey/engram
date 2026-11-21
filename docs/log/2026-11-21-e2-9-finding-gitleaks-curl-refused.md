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

**What.** Growth admission refuses gitleaks' `curl-auth-header` and `curl-auth-user`, admitted before; 210 of 222 rules are now admitted.

**Why.** Their `(?:.*?|.*?(?:[\r\n]{1,2}.*?){1,5})` before a header grows about 20 times from n to 4n in a backtracking engine (quadratic on a line of repeated `curl`).

**Result.** An Authorization header in a curl command is still found by the hand bearer rule; a `-u user:password` argument is not.

**Consequence.** Rewriting the two patterns by hand would admit them; a later card's choice.
