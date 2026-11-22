---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - packages/core/test/unit/log/attacks.test.ts
supersedes: none
---

**What.** Under the lead's decision on review finding E1.6-10, chain links hash with a prefix of their own, SHA-256(0x02 || previous || leaf), distinct from RFC 6962's 0x00 leaf and 0x01 interior node.

**Why.** With the 0x01 prefix every chain hash was a well-formed Merkle interior node; changing the prefix after chains exist outside tests would break every one of them.

**Result.** No chain exists outside tests, so nothing migrates. The checkpoint's RFC 6962 root still uses 0x01 and reproduces the Certificate Transparency vector. A mutant putting links back on 0x01 is killed.

**Consequence.** Inclusion and consistency proofs over the root can be added later without touching a chain.
