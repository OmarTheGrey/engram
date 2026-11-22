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

**What.** A checkpoint carries both the RFC 6962 root over the chain's leaves and the chain head, in a C2SP tlog-checkpoint body, with its Ed25519 signature stored beside the note rather than as a signed-note line.

**Why.** The card named the RFC 6962 tree and the C2SP format; a signed-note signature line begins with an em dash, which AGENTS.md rule 13 keeps out of the repository's text.

**Result.** The note is `engram.log/<log id>`, size, base64 root, `head <base64>`, `time <at>`; the signature is over the note's bytes; keys are base64 SPKI. The verdict is decided by the latest checkpoint, stored or held; signatures without a pinned key are noted as unpinned.

**Consequence.** A consistency proof can later build on the root; a signed-note encoder can wrap the same signature.
