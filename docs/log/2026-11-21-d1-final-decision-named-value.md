---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/scrub.ts
  - packages/core/test/unit/distill/scrub.test.ts
supersedes: none
---

**What.** The scrub's named-value rule now captures any name and splits it into words (`_`, `-`, `.`, case changes). It takes the value when the last word is a secret's (`token`, `secret`, `password`, `pwd`, `pw`, `pass`, `auth`, `cookie`, `credential` and the like), or when the name ends in `key` after `api`, `secret`, `private`, `access` or `signing`.

**Why.** Finding W-1. The old list missed names the table already treats as secrets, such as `SECRET_KEY`, `aws_secret_access_key`, `secretKey`, `private_key` and `DB_PWD`. The lead asked for word splitting instead of more alternatives.

**Result.** All seven W-1 names are redacted. `token_count`, `password_hash`, `max_tokens` and `author` are kept.

**Consequence.** A secret word that is not last (`password_confirm`) is kept. That is a stated limit, and E2.9's guard covers it.
