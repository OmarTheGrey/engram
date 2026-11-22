---
date: 2026-11-21
author: claude-agent
type: change
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/verify.ts
  - packages/core/src/log/merkle.ts
  - packages/core/test/unit/log/chain.test.ts
supersedes: none
---

**What.** verifyChain runs ordered checks (tables, genesis, links, anchor, commitments, checkpoints, held) and names the first broken link; writeCheckpoint signs the head through an injected signer.

**Why.** Card E1.6 steps 6 and 7: a verdict per log, UNSIGNED of its own, and signed checkpoints with no key in core.

**Result.** A checkpoint is a C2SP tlog-checkpoint body (origin engram.log/<log id>, size, base64 RFC 6962 root, then head and time lines) and is refused over a chain that does not verify. The Merkle port reproduces the Certificate Transparency eight-leaf root 5dc9da79...4328 (chain.test.ts). Verdicts: FAILED on any check, UNSIGNED when the latest checkpoint has no signature the injected check accepts, OK otherwise; exit codes 0, 1, 3. 22 unit tests pass on SQLite and Postgres.

**Consequence.** The CLI supplies the Ed25519 signer and check.
