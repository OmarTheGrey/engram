---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/scripts/admission.ts
supersedes: none
---

**What.** The first pass admitted rules by an absolute bound at one input size, and let quadratic ones through.

**Why.** A quadratic rule fast at 16K characters stalls at 1M: `pii/email` took 18.8 s at 262K, `contentGuard` 82 s at 524K, gitleaks' `curl-auth-user` 12.5 s at 262K. A per-match line search (`lastIndexOf` back to the text's start) made many matches quadratic too: 26.8 s for 149,796 emails in 1M characters.

**Result.** Fixed by growth admission, the email anchor and a bounded line search (273 ms for the same emails).

**Consequence.** Every rule change now passes the growth test.
