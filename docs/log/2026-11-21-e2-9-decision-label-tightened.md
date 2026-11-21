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
supersedes: none
---

**What.** The label gate of the hex and opaque key-material rules takes a strong credential word only right before the value (`api key 4f3c...`, `the secret is ...`), and the weak words `token` and `seed` only in an assignment (`seed: ...`).

**Why.** walrus searched 48 characters before the value for the word anywhere, so a git SHA or cache key a sentence after "token" or "seed" was held (E2.9-8).

**Result.** The reviewer's probes (`run with seed 3, cache key <hex>`, `the token count for commit <sha>`, `session token cache miss, trace <hex>`) are no longer held; every walrus labelled case is still found.

**Consequence.** A label further than a few characters from its value is missed.
