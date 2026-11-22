---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - packages/core/src/time.ts
supersedes: none
---

**What.** The canonical form normalises timestamps only under the keys ts, valid_from, valid_to and expires, with time.ts normalTimestamp.

**Why.** ADR 0038 asks for UTC timestamps at fixed precision; normalising any string that looks like a time would let content be rewritten between two spellings of one instant unseen.

**Result.** Two spellings of one instant hash alike in those fields; every other string, content and reasons included, is hashed as written.

**Consequence.** A new timestamp field in schema.ts needs its key added here.
