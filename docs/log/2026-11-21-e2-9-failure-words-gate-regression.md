---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/secrets-upstream.test.ts
supersedes: none
---

**What.** Letting a single capital count as a word, to leave walrus' build id `20260918T0930Z-...` alone, made the reads-as-words gate wave through AWS's example secret key.

**Why.** Its part `K7MDENG` then split into `K` and `MDENG`, both words, so the labelled key material was taken for an identifier; a ported walrus vector caught it.

**Result.** Reverted to caura's gate; the build id is held at REVIEW and listed as a divergence.

**Consequence.** None.
