---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/keys.ts
  - docs/decisions/0042-verified-actors.md
supersedes: none
---

**What.** A stored API key hash is verified only when its scrypt cost N is a power of two no larger than 2^16, with r fixed at 8 and p at 1. The bound was 2^20 before the review fix pass.

**Why.** At 2^20 with r 8, one verification may ask for 1 GiB of memory, so a crafted key file could exhaust the server. The review (finding E8.12-11) noted the lower bound had no decision entry of its own.

**Result.** Keys written by `engram key create` use N 2^14 and still verify, as does 2^16. N 2^17, r 16, p 2 and an N that is not a power of two are refused before scrypt runs, and `maxmem` is set to 256 times N times r.

**Consequence.** A key file hashed elsewhere at a cost above 2^16 is refused and must be reissued with `engram key create`.
