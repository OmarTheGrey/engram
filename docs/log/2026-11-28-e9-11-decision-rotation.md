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
  - packages/core/test/unit/crypto/keys.test.ts
supersedes: none
---

**What.** `rewrapDataKeys` is built here: every live key under one operator key is rewrapped under another, so destroying the old operator key after a shred leaves a backup's copy unopenable.

**Why.** The ADR had to say how backups and database residue are reached, and a stated mechanism with no code would be a claim without a test. It is a few lines inside the card's file.

**Result.** The rotation test: a pre-shred copy opens while the old key exists and fails once it is deleted.

**Consequence.** If the lead prefers a different backup policy, the function goes unused; it costs nothing at rest.
