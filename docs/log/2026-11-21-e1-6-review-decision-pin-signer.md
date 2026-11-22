---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/log.ts
  - packages/core/src/log/verify.ts
supersedes: none
---

**What.** engram log checkpoint --key pins the signer's own public key while it verifies, and takes --checkpoint for the checkpoints the operator holds.

**Why.** Review finding E1.6-2 needs the pinned key verified before signing; the CLI's operator has one key in hand.

**Result.** A log whose earlier checkpoints were signed under another key is refused, as is one that does not extend a held checkpoint (the CLI test, a rebuilt log). Rotating the operator's key therefore needs the old signatures dropped by hand first.

**Consequence.** A later card may add a key list for rotation.
