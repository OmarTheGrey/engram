---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.11
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0051-crypto-shredded-erasure.md
supersedes: none
---

**What.** Under `erasure.mode: shred`, offboarding still redacts the log and deletes the salts as ADR 0010 and ADR 0038 say; shredding the key is added, not substituted.

**Why.** Dropping the rewrite would change ADR 0038's verifier rule and the one rewrite of the append-only log that ADR 0010 allows against ADR 0003, which this card may not contradict. Shredding's gain is reach: copies the rewrite never saw (native store history, mirrored pi session entries, exports, pages, backups) stop opening.

**Result.** ADR 0051 decisions 5 and 6.

**Consequence.** If wrong, the log is rewritten under shred as well, and a strictly append-only log waits for a later ADR.
