---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/test/unit/policy/secrets.test.ts
supersedes: docs/log/2026-11-21-e2-9-decision-label-tightened.md
---

**What.** Beside the tight label (a strong word right before the value, `token` and `seed` only in an assignment), a REVIEW rule `secret/labelled-distant` holds a value of 32 characters or more, hexadecimal or mixed-case opaque, when token, secret, password, api key or credential stands up to four words before it; exactly 40 lowercase hex digits are exempt as a git SHA-1.

**Why.** The superseded tightening also dropped "The API token for prod is <hex64>" and its kin (V-3c).

**Result.** The four reviewer cases are held; "cache key <hex>", "run with seed 3" and "token count for commit <sha40>" are not; "session token cache miss, trace <hex64>" is held again. Benign holds are unchanged (4).

**Consequence.** Five words back, or a 40-hex secret after a strong word, passes.
