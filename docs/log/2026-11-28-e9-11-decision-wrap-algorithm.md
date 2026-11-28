---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.11
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/crypto/keys.ts
supersedes: none
---

**What.** The contract keeps AES-256-GCM with a fresh random 96-bit nonce per wrap, or any misuse-resistant wrap, rather than requiring AES-GCM-SIV or AES-KW.

**Why.** Node 24 with OpenSSL 3.5.5 lists no AES-GCM-SIV cipher, and its AES-KW (`id-aes256-wrap-pad`) binds no associated data, which the scope and version binding needs (`node -e` over `crypto.getCiphers()`).

**Result.** The interface doc and ADR decision 3 state the nonce rule; the test provider's two wraps of one key differ, tested.

**Consequence.** E9.13's real provider draws nonces from `randomBytes` and tests uniqueness.
