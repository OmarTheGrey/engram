---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/verify.ts
supersedes: none
---

**What.** The checkpoint format stands as decided (a C2SP tlog-checkpoint body with the RFC 6962 root and head and time lines, the Ed25519 signature beside it, keys as base64 SPKI), and its decoder is now strict.

**Why.** Review finding E1.6-10: C2SP requires a decoder to reject a size with leading zeros and non-canonical base64; the verdict part of the earlier entry is replaced by the verdict rule.

**Result.** parseNote refuses both, and a hash that is not 32 bytes (attacks.test.ts). A checkpoint is written only after the whole log verifies under the signer's own key and every held checkpoint given (E1.6-2).

**Consequence.** The verdict rule is in its own entry.
