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
supersedes: docs/log/2026-11-21-d1-verify-decision-hold-names.md
---

**What.** A long name (tool, model, custom type, stop reason) is checked with the whole scrub except the 32-character rule. It is checked once more with underscores read as spaces, against the key-shaped rules only: `sk-` keys and URL credentials.

**Why.** The previous pass ran every rule on the spaced form. The flag rule then read `mcp__firebase-auth__list_users` as `-auth list` and held it. The superseded entry wrongly said only an `sk-` piece costs a hold.

**Result.** `mcp__firebase-auth__list_users`, `mcp__vault-pass__unlock`, `set-password_policy`, `mcp__x__refresh-token_now` and `mcp__my-key__x` are not held. `mcp__x__sk-...` and a URL credential are held.

**Consequence.** A spaced-form hold now comes only from `sk-` and URL credentials. Restoring the full spaced check fails five tests.
